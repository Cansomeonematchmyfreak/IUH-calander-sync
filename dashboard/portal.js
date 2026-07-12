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


/* ============================================================
   TÍCH HỢP TỰ ĐỘNG HÓA GHOST TAB & SIDEBAR NAV
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Quản lý chuyển đổi Tab trên Sidebar (Hiệu ứng Active)
    const navGrades = $('nav-grades');
    const navSchedule = $('nav-schedule');
    const navSurvey = $('nav-survey');

    function switchActiveNav(activeNav) {
        [navGrades, navSchedule, navSurvey].forEach(nav => {
            if(nav) nav.classList.remove('active');
        });
        if(activeNav) activeNav.classList.add('active');
    }

    // Lắng nghe sự kiện kích hoạt Khảo sát tự động
    if (navSurvey) {
        navSurvey.addEventListener('click', (e) => {
            e.preventDefault();
            switchActiveNav(navSurvey);

            if (confirm("Extension sẽ tự động tích chọn 'Bình thường' và điền form tất cả các phiếu khảo sát chưa hoàn thành theo kịch bản ngầm. Tiếp tục?")) {
                // Thiết lập trạng thái chạy tự động khảo sát
                chrome.storage.local.set({
                    'iuh_auto_survey_running': true,
                    'iuh_survey_current_index': 0,
                    'iuh_survey_urls': []
                }, () => {
                    // Ra lệnh cho background mở tab danh sách khảo sát để survey_agent.js xử lý
                    chrome.runtime.sendMessage({ action: "triggerAutoSurvey" });
                });
            }
        });
    }
});

/**
 * Bổ sung cơ chế tự động tái đăng nhập nếu phát hiện hết hạn phiên (Session) 
 * Tích hợp trực tiếp vào hàm trigerSync() sẵn có của portal.js
 */
function triggerSyncEnhanced() {
    const btnSync = $('btn-sync-grades');
    const tbody = $('grade-table-body');

    if (btnSync) btnSync.innerHTML = `<span class="icon">⏳</span> Đang đồng bộ...`;
    tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium">Đang tải và phân tích dữ liệu từ trường...</td></tr>`;

    fetchAndProcessGrades().then(data => {
        if (!data) {
            // Khi data trả về null hoặc lỗi, khả năng cao là Session đã hết hạn
            if (btnSync) btnSync.innerHTML = `<span class="icon">🔑</span> Đang cấp lại phiên...`;
            tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium">Phát hiện phiên đăng nhập hết hạn. Đang kích hoạt Ghost Tab đăng nhập lại tự động bằng AI...</td></tr>`;
            
            // Gửi yêu cầu Khởi động Ghost Tab đăng nhập ngầm để lấy Cookie mới
            chrome.runtime.sendMessage({ action: "renewSessionViaGhostTab" });
            return;
        }
        globalDashboardData = data;
        renderDashboard(data);
        if (btnSync) btnSync.innerHTML = `<span class="icon">✅</span> Đã cập nhật`;
        setTimeout(() => {
            if (btnSync) btnSync.innerHTML = `<span class="icon">🔄</span> Làm mới dữ liệu gốc`;
        }, 3000);
    });
}

/// Lắng nghe sự kiện cấp phiên thành công từ Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sessionRenewedSuccessfully") {
        console.log("[Dashboard] Phiên đã sẵn sàng, tự động kích hoạt cào lại điểm.");
        // Gọi lại logic đồng bộ hóa gốc của portal.js để render điểm mới
        if (typeof triggerSync === 'function') {
            triggerSync();
        }
    }
});

/* ============================================================
   TÍCH HỢP QUẢN LÝ TAB SPA, FORM OPTION & INTERACTIVE MODAL
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Định nghĩa các phần tử điều hướng và hiển thị Tab
    const navGrades = $('nav-grades');
    const navSchedule = $('nav-schedule');
    const navSurvey = $('nav-survey');
    const navSettings = $('nav-settings');

    const tabGrades = $('tab-content-grades');
    const tabSettings = $('tab-content-settings');

    // 2. Khối phần tử xử lý Modal Số tuần lịch học
    const modalWeeks = $('modal-weeks-sync');
    const weeksInput = $('sync-weeks-input');
    const btnCloseWeeksModal = $('btn-close-weeks-modal');
    const btnSubmitWeeksModal = $('btn-submit-weeks-modal');

    // 3. Khối phần tử liên quan đến Form Cài đặt
    const txtUser = $('setting-user');
    const txtPass = $('setting-pass');
    const chkAutoFill = $('setting-auto-fill');
    const chkAutoLogin = $('setting-auto-login');
    const btnTogglePassword = $('btn-toggle-password');
    const btnSaveSettings = $('btn-save-settings');
    
    // Tách biệt 5 Element điều khiển màu sắc tương ứng
    const selColorDirect = $('setting-color-direct');
    const selColorOnline = $('setting-color-online');
    const selColorPractice = $('setting-color-practice');
    const selColorPostponed = $('setting-color-postponed');
    const selColorExam = $('setting-color-exam');

    // Mẫu danh sách màu sắc dựa trên Color Enum của Google Apps Script
    const colorOptionsHtml = `
        <option value="1">Lavender (Tím nhạt)</option>
        <option value="2">Sage (Xanh lá nhạt)</option>
        <option value="3">Grape (Tím đậm)</option>
        <option value="4">Flamingo (Hồng)</option>
        <option value="5">Banana (Vàng nhạt)</option>
        <option value="6">Tangerine (Cam)</option>
        <option value="7">Peacock (Xanh lơ)</option>
        <option value="8">Graphite (Xám)</option>
        <option value="9">Blueberry (Xanh dương)</option>
        <option value="10">Basil (Xanh lá đậm)</option>
        <option value="11">Tomato (Đỏ)</option>
    `;

    // Render danh sách tùy chọn vào toàn bộ các Select Input màu sắc
    document.querySelectorAll('.color-select-input').forEach(select => {
        if (select) select.innerHTML = colorOptionsHtml;
    });

    // --- TÍNH NĂNG 1: TOGGLE HIỆN/ẨN MẬT KHẨU (SVG ICONS) ---
    const iconEyeVisible = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const iconEyeHidden = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    if (btnTogglePassword && txtPass) {
        // Đặt Icon mặc định lúc vừa render JS
        btnTogglePassword.innerHTML = iconEyeHidden;
        
        btnTogglePassword.addEventListener('click', () => {
            if (txtPass.type === 'password') {
                txtPass.type = 'text'; // Hiện mật khẩu
                btnTogglePassword.innerHTML = iconEyeVisible; 
                btnTogglePassword.title = 'Ẩn mật khẩu';
            } else {
                txtPass.type = 'password'; // Ẩn mật khẩu
                btnTogglePassword.innerHTML = iconEyeHidden;
                btnTogglePassword.title = 'Hiện mật khẩu';
            }
        });
        
        // Thêm hiệu ứng hover đổi màu cho icon con mắt
        btnTogglePassword.addEventListener('mouseenter', () => btnTogglePassword.style.color = '#fff');
        btnTogglePassword.addEventListener('mouseleave', () => btnTogglePassword.style.color = 'var(--text-muted)');
    }

    // --- TÍNH NĂNG 2: TẢI DỮ LIỆU CẤU HÌNH PHÂN PHỐI 5 MÀU SẮC RỜI RẠC ---
    function loadSettingsToForm() {
        chrome.storage.sync.get([
            'iuhUser', 'iuhPass', 'autoFillInfo', 'autoClickLogin', 
            'calendarColorDirect', 'calendarColorOnline', 'calendarColorPractice', 'calendarColorPostponed', 'calendarColorExam'
        ], (result) => {
            if (txtUser) txtUser.value = result.iuhUser || '';
            if (txtPass) txtPass.value = result.iuhPass || '';
            if (chkAutoFill) chkAutoFill.checked = result.autoFillInfo !== false;
            if (chkAutoLogin) chkAutoLogin.checked = result.autoClickLogin !== false;
            
            // Gán giá trị lưu trữ hoặc giá trị mặc định trực quan cho từng loại
            if (selColorDirect) selColorDirect.value = result.calendarColorDirect || '9';    
            if (selColorOnline) selColorOnline.value = result.calendarColorOnline || '7';    
            if (selColorPractice) selColorPractice.value = result.calendarColorPractice || '2';
            if (selColorPostponed) selColorPostponed.value = result.calendarColorPostponed || '8';
            if (selColorExam) selColorExam.value = result.calendarColorExam || '11';        
        });
    }

    // --- TÍNH NĂNG 3: LƯU TẤT CẢ THÔNG SỐ VÀO CHROME STORAGE ---
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const dataToSave = {
                iuhUser: txtUser.value.trim(),
                iuhPass: txtPass.value,
                autoFillInfo: chkAutoFill.checked,
                autoClickLogin: chkAutoLogin.checked,
                calendarColorDirect: selColorDirect.value,
                calendarColorOnline: selColorOnline.value,
                calendarColorPractice: selColorPractice.value,
                calendarColorPostponed: selColorPostponed.value,
                calendarColorExam: selColorExam.value
            };

            chrome.storage.sync.set(dataToSave, () => {
                btnSaveSettings.innerText = '✅ Đã cấu hình hệ thống thành công!';
                btnSaveSettings.style.background = 'var(--success)';
                setTimeout(() => {
                    btnSaveSettings.innerText = '💾 Lưu cấu hình hệ thống';
                    btnSaveSettings.style.background = 'var(--primary)';
                }, 2000);
            });
        });
    }

    // --- LOGIC CHUYỂN TAB SPA ---
    function switchTab(activeNav, activeTabId) {
        [navGrades, navSchedule, navSurvey, navSettings].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
        if (activeNav) activeNav.classList.add('active');

        if (activeTabId === 'grades') {
            tabGrades.style.display = 'block';
            tabSettings.style.display = 'none';
        } else if (activeTabId === 'settings') {
            tabGrades.style.display = 'none';
            tabSettings.style.display = 'block';
            loadSettingsToForm(); // Tải lại dữ liệu cấu hình thực tế lên form
        }
    }

    if (navGrades) navGrades.addEventListener('click', (e) => { e.preventDefault(); switchTab(navGrades, 'grades'); });
    if (navSettings) navSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab(navSettings, 'settings'); });

    // --- XỬ LÝ ĐỒNG BỘ LỊCH HỌC QUA POPUP INTERACTIVE ---
    
    if (navSchedule) {
        navSchedule.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 1. Đổi màu highlight cho Tab Lịch Học
            [navGrades, navSchedule, navSurvey, navSettings].forEach(nav => {
                if (nav) nav.classList.remove('active');
            });
            navSchedule.classList.add('active');

            // 2. CHỈ HIỂN THỊ FORM NHẬP SỐ TUẦN (Không chạy ngầm gì ở bước này cả)
            if (modalWeeks) {
                modalWeeks.style.display = 'flex';
                if (weeksInput) {
                    weeksInput.value = '5'; // Điền sẵn số 5 mặc định
                    weeksInput.focus();
                    weeksInput.select();
                }
            }
        });
    }

    // --- HÀM TẮT FORM ---
    function closeWeeksModal() {
        if (modalWeeks) modalWeeks.style.display = 'none';
    }

    if (btnCloseWeeksModal) btnCloseWeeksModal.addEventListener('click', closeWeeksModal);
    if (modalWeeks) {
        modalWeeks.addEventListener('click', (e) => {
            if (e.target === modalWeeks) closeWeeksModal();
        });
    }

    // --- EVENT STARTER: KÍCH HOẠT CHẠY NGẦM KHI BẤM "CẬP NHẬT" TẠI FORM ---
    let isExecutingSync = false;
    function executeScheduleSync() {
        if (isExecutingSync || !weeksInput) return;
        isExecutingSync = true;
        
        // Đổi giao diện nút để báo hiệu hệ thống đã nhận lệnh
        const originalBtnText = btnSubmitWeeksModal.innerText;
        btnSubmitWeeksModal.innerText = '⏳ Đang khởi động...';
        btnSubmitWeeksModal.style.opacity = '0.7';

        const totalWeeks = parseInt(weeksInput.value, 10) || 5;

        // Lưu thông số tuần vào Storage cho Ghost Tab đọc
        chrome.storage.local.set({
            iuh_sync_weeks_count: totalWeeks,
            iuh_auto_sync_active: true
        }, () => {
            chrome.runtime.sendMessage({ action: "triggerManualScheduleSync" });
            closeWeeksModal(); // Đóng form điền số
            
            // Mở khóa UI chống Spam sau 2 giây
            setTimeout(() => {
                isExecutingSync = false;
                if (btnSubmitWeeksModal) {
                    btnSubmitWeeksModal.innerText = originalBtnText;
                    btnSubmitWeeksModal.style.opacity = '1';
                }
            }, 2000);
        });
    }

    // Lắng nghe sự kiện click hoặc gõ Enter tại form
    if (btnSubmitWeeksModal) btnSubmitWeeksModal.addEventListener('click', executeScheduleSync);
    if (weeksInput) {
        weeksInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeScheduleSync();
            }
        });
    }






    // --- KHỞI CHẠY NGẦM ĐỂ ĐIỀN DỮ LIỆU GỐC CHO VIEW BẢNG ĐIỂM ---
    chrome.storage.local.get(['iuh_grade_data'], result => {
        if (result.iuh_grade_data) {
            globalDashboardData = result.iuh_grade_data;
            renderDashboard(globalDashboardData);
        } else {
            if (typeof triggerSync === 'function') triggerSync();
        }
    });
    
    const btnSyncGrades = $('btn-sync-grades');
    if (btnSyncGrades) btnSyncGrades.addEventListener('click', triggerSync);
}); 