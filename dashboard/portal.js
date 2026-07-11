// dashboard/portal.js
//
// Phụ thuộc vào grade-scraper.js được nạp TRƯỚC file này (thẻ <script> tuần tự
// trong portal.html), cung cấp sẵn:
//   - hàm lamTronDiemIUH(diem)
//   - hàm fetchAndProcessGrades() -> Promise<data>
//   - chrome.storage.local (API mở rộng trình duyệt)
//
// File này CHỈ refactor lại logic hiển thị/mô phỏng, KHÔNG đổi API, KHÔNG đổi
// id/class trong portal.html, KHÔNG đổi portal.css (chỉ dùng các class đã có
// sẵn: score-low, score-normal, grade-a, grade-b, grade-c, grade-d, grade-f).

'use strict';

let globalDashboardData = null;

// Lưu trạng thái hiển thị của biểu đồ tiến độ (tín chỉ hiện tại / tổng tín chỉ)
// để dùng lại khi hover và khi mô phỏng sửa điểm.
let progressState = { current: 0, total: 130 };

/* ============================================================
   HẰNG SỐ & TIỆN ÍCH DÙNG CHUNG
   ============================================================ */
const SVG_R_OUTER = 50;
const SVG_R_INNER = 35;
const C_OUTER = 2 * Math.PI * SVG_R_OUTER;
const C_INNER = 2 * Math.PI * SVG_R_INNER;

function $(id) {
    return document.getElementById(id);
}

/** Định dạng điểm số 2 chữ số thập phân, trả về "-" nếu null/NaN. */
function formatDiem(value, digits = 2) {
    return value !== null && value !== undefined && !isNaN(value) ? value.toFixed(digits) : '-';
}

/** Trả về tên class màu ("score-low" | "score-normal" | "") theo quy tắc <=5 đỏ, >5 trắng. */
function scoreClassName(value) {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num <= 5 ? 'score-low' : 'score-normal';
}

/** Gán class màu điểm (score-low/score-normal) cho một phần tử theo giá trị điểm. */
function setScoreColorClass(el, value) {
    el.classList.remove('score-low', 'score-normal');
    const cls = scoreClassName(value);
    if (cls) el.classList.add(cls);
}

/** Gán class màu điểm chữ (grade-a..grade-f) cho một phần tử. */
function setGradeLetterClass(el, chu) {
    el.classList.remove('grade-a', 'grade-b', 'grade-c', 'grade-d', 'grade-f');
    switch (chu) {
        case 'A+':
        case 'A':
            el.classList.add('grade-a');
            break;
        case 'B+':
        case 'B':
            el.classList.add('grade-b');
            break;
        case 'C+':
        case 'C':
            el.classList.add('grade-c');
            break;
        case 'D+':
        case 'D':
            el.classList.add('grade-d');
            break;
        default:
            el.classList.add('grade-f');
    }
}

/* ============================================================
   QUY ĐỔI ĐIỂM (thuần logic, không đụng DOM)
   ============================================================ */

/** Làm tròn GPA về 2 chữ số thập phân, trả về chuỗi. */
function roundGPA(sumDiem, tongTC) {
    if (!tongTC) return '0.00';
    const gpa = sumDiem / tongTC;
    return (Math.round(gpa * 100) / 100).toFixed(2);
}

/** Xếp loại học lực theo hệ 4 chuẩn IUH. */
function getXepLoaiHocLuc(gpa4) {
    if (gpa4 >= 3.6) return 'Xuất sắc';
    if (gpa4 >= 3.2) return 'Giỏi';
    if (gpa4 >= 2.5) return 'Khá';
    if (gpa4 >= 2.0) return 'Trung bình';
    if (gpa4 >= 1.0) return 'Yếu';
    return 'Kém';
}

/** Quy đổi điểm hệ 10 -> {điểm chữ, hệ 4, xếp loại môn học, đạt/không đạt}. */
function quyDoiHeChuVaHe4(diem10, isTotNghiep = false) {
    if (isTotNghiep && diem10 < 5.0) return { chu: 'F', he4: 0.0, xepLoai: 'Chưa đạt', isDat: false };
    if (diem10 >= 9.0) return { chu: 'A+', he4: 4.0, xepLoai: 'Xuất sắc', isDat: true };
    if (diem10 >= 8.5) return { chu: 'A', he4: 3.8, xepLoai: 'Giỏi', isDat: true };
    if (diem10 >= 8.0) return { chu: 'B+', he4: 3.5, xepLoai: 'Khá', isDat: true };
    if (diem10 >= 7.0) return { chu: 'B', he4: 3.0, xepLoai: 'Khá', isDat: true };
    if (diem10 >= 6.5) return { chu: 'C+', he4: 2.5, xepLoai: 'Trung bình', isDat: true };
    if (diem10 >= 5.5) return { chu: 'C', he4: 2.0, xepLoai: 'Trung bình', isDat: true };
    if (diem10 >= 5.0) return { chu: 'D+', he4: 1.5, xepLoai: 'Trung bình yếu', isDat: true };
    if (diem10 >= 4.0) return { chu: 'D', he4: 1.0, xepLoai: 'Trung bình yếu', isDat: true };
    return { chu: 'F', he4: 0.0, xepLoai: 'Kém', isDat: false };
}

/**
 * Tính điểm tổng kết hệ 10 từ các thành phần điểm thô của một môn học.
 * Dùng chung cho cả lúc mô phỏng (simulateRowCalculation) lẫn có thể tái sử
 * dụng nếu cần tính lại từ đầu, tránh lặp code công thức tích hợp/thực hành.
 */
function tinhDiemTongKet({ tkVals, thVals, diemGK, diemThi, soTC, isTotNghiep, isThucHanhThuan, isTichHop }) {
    const diemTK_TongKet =
        tkVals.length > 0 ? lamTronDiemIUH(tkVals.reduce((a, b) => a + b, 0) / tkVals.length) : null;
    const diemTH_TongKet =
        thVals.length > 0 ? lamTronDiemIUH(thVals.reduce((a, b) => a + b, 0) / thVals.length) : null;

    if (isTotNghiep) {
        return diemThi !== null ? diemThi : null;
    }

    if (isThucHanhThuan) {
        return diemTH_TongKet;
    }

    if (isTichHop) {
        const diemLT =
            diemThi !== null && diemThi < 3.0
                ? diemThi
                : lamTronDiemIUH(0.5 * (diemThi || 0) + 0.3 * (diemGK || 0) + 0.2 * (diemTK_TongKet || 0));

        if ((diemTH_TongKet !== null && diemTH_TongKet < 3.0) || diemLT === 0 || diemTH_TongKet === 0) {
            return 0.0;
        }
        if (diemTH_TongKet !== null && diemThi !== null) {
            const j_lt = soTC > 1 ? soTC - 1 : 1;
            const j_th = 1;
            return parseFloat(((diemLT * j_lt + diemTH_TongKet * j_th) / soTC).toFixed(1));
        }
        return null;
    }

    // Môn lý thuyết thông thường
    if (diemThi !== null && diemThi < 3.0) return diemThi;
    if (diemThi !== null && diemGK !== null && diemTK_TongKet !== null) {
        return parseFloat((0.5 * diemThi + 0.3 * diemGK + 0.2 * diemTK_TongKet).toFixed(1));
    }
    return null;
}

/* ============================================================
   BIỂU ĐỒ TIẾN ĐỘ (SVG TÍN CHỈ)
   ============================================================ */

function resetProgressText() {
    $('val-tin-chi').innerText = `${progressState.current}/${progressState.total}`;
    $('val-tin-chi').style.color = '#f8fafc';
    $('lbl-tin-chi').innerText = 'Tín chỉ';
}

/** Vẽ lại vòng tròn "tín chỉ hiện tại" + cập nhật chữ giữa biểu đồ theo progressState. */
function updateProgressDisplay() {
    const circleCurrent = $('svg-circle-current');
    const percent = progressState.total ? Math.min(progressState.current / progressState.total, 1) : 0;
    circleCurrent.style.strokeDashoffset = C_INNER - percent * C_INNER;
    resetProgressText();
}

function renderProgressChart(creditInfo) {
    progressState.current = creditInfo ? creditInfo.current : 0;
    progressState.total = creditInfo ? creditInfo.total : 130;

    const circleTotal = $('svg-circle-total');
    const circleCurrent = $('svg-circle-current');

    // Vòng ngoài luôn vẽ full (đại diện tổng CTĐT)
    circleTotal.style.strokeDasharray = C_OUTER;
    circleTotal.style.strokeDashoffset = 0;
    circleCurrent.style.strokeDasharray = C_INNER;

    updateProgressDisplay();

    circleTotal.addEventListener('mouseenter', () => {
        $('val-tin-chi').innerText = progressState.total;
        $('val-tin-chi').style.color = '#00a8ff';
        $('lbl-tin-chi').innerText = 'Tổng TC';
    });

    circleCurrent.addEventListener('mouseenter', () => {
        const percent = progressState.total ? Math.min(progressState.current / progressState.total, 1) : 0;
        $('val-tin-chi').innerText = `${(percent * 100).toFixed(1)}%`;
        $('val-tin-chi').style.color = '#32cd32';
        $('lbl-tin-chi').innerText = 'Hoàn thành';
    });

    circleTotal.addEventListener('mouseleave', resetProgressText);
    circleCurrent.addEventListener('mouseleave', resetProgressText);
}

/* ============================================================
   DỰNG BẢNG ĐIỂM (DOM BUILDERS)
   ============================================================ */

/** Dựng 1 ô <td><input></td> cho điểm thành phần, tô màu sẵn theo giá trị ban đầu. */
function buildScoreInputCell(value, extraClass) {
    const v = value !== null && value !== undefined ? value : '';
    const classes = ['edit-input', extraClass, scoreClassName(v)].filter(Boolean).join(' ');
    return `<td class="text-center" style="padding: 4px;"><input type="number" step="0.1" class="${classes}" value="${v}"></td>`;
}

function buildSemesterHeaderRow(semesterName) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="20" style="background: rgba(59, 130, 246, 0.1); color: var(--primary); font-weight: bold;">📚 ${semesterName}</td>`;
    return tr;
}

function buildSemesterSummaryRow(semIndex) {
    const tr = document.createElement('tr');
    tr.className = 'semester-summary-row';
    tr.innerHTML = `
        <td colspan="20" style="background-color: rgba(255, 255, 255, 0.02); padding: 16px 24px; border-bottom: 2px solid var(--border-color);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13.5px; color: var(--text-muted);">
                <div><span style="color: var(--text-main);">Điểm TB học kỳ (hệ 10):</span> <strong class="text-orange" id="sem-gpa10-${semIndex}">--</strong></div>
                <div><span style="color: var(--text-main);">Điểm TB học kỳ (hệ 4):</span> <strong class="text-orange" id="sem-gpa4-${semIndex}">--</strong></div>

                <div><span style="color: var(--text-main);">Điểm TB tích lũy:</span> <strong class="text-orange" id="cum-gpa10-${semIndex}">--</strong></div>
                <div><span style="color: var(--text-main);">Điểm TB tích lũy (hệ 4):</span> <strong class="text-orange" id="cum-gpa4-${semIndex}">--</strong></div>

                <div><span style="color: var(--text-main);">Xếp loại học lực học kỳ:</span> <strong class="text-blue" id="sem-xl-${semIndex}">--</strong></div>
                <div><span style="color: var(--text-main);">Xếp loại học lực tích lũy:</span> <strong class="text-green" id="cum-xl-${semIndex}">--</strong></div>
            </div>
        </td>
    `;
    return tr;
}

function buildSubjectRow(sub, semIndex) {
    const tr = document.createElement('tr');
    tr.className = 'subject-row';
    tr.dataset.semIdx = semIndex;
    tr.dataset.mahp = sub.maHP;
    tr.dataset.tc = sub.soTC;
    tr.dataset.excluded = sub.isExcludedFromGPA;
    tr.dataset.istichhop = sub.isTichHop;
    tr.dataset.isthuchanhthuan = sub.isThucHanhThuan;
    tr.dataset.istotnghiep = sub.isTotNghiep;

    const excludedBadge = sub.isExcludedFromGPA
        ? `<br><span style="font-size: 10px; color: var(--text-muted);">(Không tính GPA)</span>`
        : '';
    const tickMark = sub.isDat
        ? '<span style="color: var(--success); font-size: 16px;">✅</span>'
        : '<span style="color: var(--danger); font-size: 16px;">❌</span>';

    const tkHtml = Array.from({ length: 6 }, (_, i) =>
        buildScoreInputCell(sub.tk && sub.tk[i] !== undefined ? sub.tk[i] : null, 'tk-input')
    ).join('');
    const thHtml = Array.from({ length: 4 }, (_, i) =>
        buildScoreInputCell(sub.th && sub.th[i] !== undefined ? sub.th[i] : null, 'th-input')
    ).join('');

    tr.innerHTML = `
        <td>${sub.maHP}</td>
        <td class="font-medium">${sub.tenHP}${excludedBadge}</td>
        <td class="text-center font-bold">${sub.soTC}</td>
        ${tkHtml}
        ${thHtml}
        ${buildScoreInputCell(sub.diemGK, 'gk-input')}
        ${buildScoreInputCell(sub.diemThi, 'ck-input')}
        <td class="text-center font-bold cell-he10">${formatDiem(sub.diem10)}</td>
        <td class="text-center font-bold cell-he4">${formatDiem(sub.diem4)}</td>
        <td class="text-center font-bold cell-chu">${sub.diemChu || '-'}</td>
        <td class="text-center font-medium cell-xl">${sub.xepLoai || '-'}</td>
        <td class="text-center cell-dat">${tickMark}</td>
    `;

    // Hệ 4 luôn lấy màu theo Hệ 10 (không dùng ngưỡng riêng)
    setScoreColorClass(tr.querySelector('.cell-he10'), sub.diem10);
    setScoreColorClass(tr.querySelector('.cell-he4'), sub.diem10);
    setGradeLetterClass(tr.querySelector('.cell-chu'), sub.diemChu);

    // Mỗi input chỉ gắn đúng 1 listener mô phỏng
    tr.querySelectorAll('.edit-input').forEach(inp => {
        inp.addEventListener('input', () => simulateRowCalculation(tr));
    });

    return tr;
}

function renderSemesters(semesters) {
    const tbody = $('grade-table-body');
    semesters.forEach((sem, semIndex) => {
        if (!sem.subjects.length) return;
        tbody.appendChild(buildSemesterHeaderRow(sem.semesterName));
        sem.subjects.forEach(sub => tbody.appendChild(buildSubjectRow(sub, semIndex)));
        tbody.appendChild(buildSemesterSummaryRow(semIndex));
    });
}

/* ============================================================
   MÔ PHỎNG KHI SỬA ĐIỂM
   ============================================================ */

function simulateRowCalculation(tr) {
    const isTichHop = tr.dataset.istichhop === 'true';
    const isThucHanhThuan = tr.dataset.isthuchanhthuan === 'true';
    const isTotNghiep = tr.dataset.istotnghiep === 'true';
    const soTC = parseInt(tr.dataset.tc, 10);

    const readInputs = selector =>
        Array.from(tr.querySelectorAll(selector))
            .map(inp => parseFloat(inp.value))
            .filter(v => !isNaN(v));

    const tkVals = readInputs('.tk-input');
    const thVals = readInputs('.th-input');

    const gkVal = parseFloat(tr.querySelector('.gk-input').value);
    const diemGK = isNaN(gkVal) ? null : gkVal;

    const ckVal = parseFloat(tr.querySelector('.ck-input').value);
    const diemThi = isNaN(ckVal) ? null : ckVal;

    const diem10 = tinhDiemTongKet({
        tkVals,
        thVals,
        diemGK,
        diemThi,
        soTC,
        isTotNghiep,
        isThucHanhThuan,
        isTichHop
    });

    const quyDoi = diem10 !== null ? quyDoiHeChuVaHe4(diem10, isTotNghiep) : { chu: '', he4: null, xepLoai: '', isDat: false };

    // Cập nhật màu từng ô input theo giá trị hiện tại
    tr.querySelectorAll('.edit-input').forEach(inp => setScoreColorClass(inp, inp.value));

    // Cập nhật các ô kết quả
    const he10Cell = tr.querySelector('.cell-he10');
    const he4Cell = tr.querySelector('.cell-he4');
    const chuCell = tr.querySelector('.cell-chu');
    const xlCell = tr.querySelector('.cell-xl');
    const datCell = tr.querySelector('.cell-dat');

    he10Cell.innerText = formatDiem(diem10);
    he4Cell.innerText = formatDiem(quyDoi.he4);
    chuCell.innerText = quyDoi.chu || '-';
    xlCell.innerText = quyDoi.xepLoai || '-';
    datCell.innerHTML = quyDoi.isDat
        ? '<span style="color: var(--success); font-size: 16px;">✅</span>'
        : '<span style="color: var(--danger); font-size: 16px;">❌</span>';

    // Hệ 4 luôn lấy màu theo Hệ 10
    setScoreColorClass(he10Cell, diem10);
    setScoreColorClass(he4Cell, diem10);
    setGradeLetterClass(chuCell, quyDoi.chu);

    tr.classList.add('modified-row');
    recalculateOverallGPA();
}

/* ============================================================
   TÍNH TOÁN REAL-TIME CHO CÁC BẢNG TỔNG KẾT
   ============================================================ */

/** Cộng dồn điểm/tín chỉ của 1 học kỳ vào globalHistory (giữ điểm cao nhất mỗi môn). */
function computeSemesterAggregates(semIndex, globalHistory) {
    const semRows = document.querySelectorAll(`tr.subject-row[data-sem-idx="${semIndex}"]`);
    let semTC = 0;
    let semSum10 = 0;
    let semSum4 = 0;

    semRows.forEach(tr => {
        const maHP = tr.dataset.mahp;
        const isExcluded = tr.dataset.excluded === 'true';
        const soTC = parseInt(tr.dataset.tc, 10);
        const he10 = parseFloat(tr.querySelector('.cell-he10').innerText);
        const he4 = parseFloat(tr.querySelector('.cell-he4').innerText);
        const isDat = tr.querySelector('.cell-dat').innerHTML.includes('✅');

        if (isNaN(he10) || isNaN(he4)) return;

        if (!isExcluded) {
            semTC += soTC;
            semSum10 += he10 * soTC;
            semSum4 += he4 * soTC;
        }

        if (!globalHistory[maHP] || he10 > globalHistory[maHP].he10) {
            globalHistory[maHP] = { he10, he4, soTC, isExcluded, isDat };
        }
    });

    return { semTC, semSum10, semSum4 };
}

/** Tính GPA/tín chỉ tích lũy từ toàn bộ globalHistory tính đến thời điểm hiện tại. */
function computeCumulativeAggregates(globalHistory) {
    let cumTC = 0;
    let cumSum10 = 0;
    let cumSum4 = 0;
    let cumTCDat = 0;

    Object.values(globalHistory).forEach(sub => {
        if (sub.isDat) cumTCDat += sub.soTC;
        if (!sub.isExcluded) {
            cumTC += sub.soTC;
            cumSum10 += sub.he10 * sub.soTC;
            cumSum4 += sub.he4 * sub.soTC;
        }
    });

    return { cumTC, cumSum10, cumSum4, cumTCDat };
}

function updateSemesterSummaryUI(semIndex, sGpa10, sGpa4, cGpa10, cGpa4) {
    const elSemGpa10 = $(`sem-gpa10-${semIndex}`);
    if (!elSemGpa10) return;

    elSemGpa10.innerText = sGpa10;
    $(`sem-gpa4-${semIndex}`).innerText = sGpa4;
    $(`sem-xl-${semIndex}`).innerText = getXepLoaiHocLuc(parseFloat(sGpa4));

    $(`cum-gpa10-${semIndex}`).innerText = cGpa10;
    $(`cum-gpa4-${semIndex}`).innerText = cGpa4;
    $(`cum-xl-${semIndex}`).innerText = getXepLoaiHocLuc(parseFloat(cGpa4));
}

function recalculateOverallGPA() {
    if (!globalDashboardData) return;

    const globalHistory = {};
    let totalTCDatOverall = 0;
    const numSemesters = globalDashboardData.semesters.length;

    for (let i = 0; i < numSemesters; i++) {
        const semRows = document.querySelectorAll(`tr.subject-row[data-sem-idx="${i}"]`);
        if (semRows.length === 0) continue;

        const { semTC, semSum10, semSum4 } = computeSemesterAggregates(i, globalHistory);
        const sGpa10 = roundGPA(semSum10, semTC);
        const sGpa4 = roundGPA(semSum4, semTC);

        const { cumTC, cumSum10, cumSum4, cumTCDat } = computeCumulativeAggregates(globalHistory);
        const cGpa10 = roundGPA(cumSum10, cumTC);
        const cGpa4 = roundGPA(cumSum4, cumTC);

        updateSemesterSummaryUI(i, sGpa10, sGpa4, cGpa10, cGpa4);
        totalTCDatOverall = cumTCDat;
    }

    const { cumTC: finalCumTC, cumSum10: finalCumSum10, cumSum4: finalCumSum4 } = computeCumulativeAggregates(globalHistory);

    // Cập nhật card "Tiến độ đào tạo" (giữ định dạng x/tổng, không mất tổng tín chỉ)
    progressState.current = totalTCDatOverall;
    updateProgressDisplay();

    $('val-gpa-10').innerText = roundGPA(finalCumSum10, finalCumTC);
    $('val-gpa-4').innerText = roundGPA(finalCumSum4, finalCumTC);
}

/* ============================================================
   RENDER TỔNG & ĐỒNG BỘ DỮ LIỆU
   ============================================================ */

function renderDashboard(data) {
    const tbody = $('grade-table-body');
    tbody.innerHTML = '';

    renderProgressChart(data.creditInfo);
    renderSemesters(data.semesters);
    recalculateOverallGPA();
}

function triggerSync() {
    const btnSync = $('btn-sync-grades');
    const tbody = $('grade-table-body');

    if (btnSync) btnSync.innerHTML = `<span class="icon">⏳</span> Đang đồng bộ...`;
    tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium">Đang tải và phân tích dữ liệu từ trường...</td></tr>`;

    fetchAndProcessGrades().then(data => {
        if (!data) return;
        globalDashboardData = data;
        renderDashboard(data);
        if (btnSync) btnSync.innerHTML = `<span class="icon">✅</span> Đã cập nhật`;
        setTimeout(() => {
            if (btnSync) btnSync.innerHTML = `<span class="icon">🔄</span> Làm mới dữ liệu gốc`;
        }, 3000);
    });
}

/* ============================================================
   KHỞI TẠO
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['iuh_grade_data'], result => {
        if (result.iuh_grade_data) {
            globalDashboardData = result.iuh_grade_data;
            renderDashboard(globalDashboardData);
        } else {
            triggerSync();
        }
    });

    const btnSync = $('btn-sync-grades');
    if (btnSync) btnSync.addEventListener('click', triggerSync);

    const regPanel = $('reg-panel');
    const btnToggleReg = $('btn-toggle-reg');
    if (btnToggleReg) {
        btnToggleReg.addEventListener('click', () => {
            regPanel.classList.toggle('show');
            btnToggleReg.innerText = regPanel.classList.contains('show') ? '✕' : 'i';
        });
    }
});