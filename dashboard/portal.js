// dashboard/portal.js
'use strict';

let globalDashboardData = null;
let progressState = { current: 0, total: 130 };
let isSyncing = false;

const GOOGLE_COLOR_OPTIONS_HTML = `
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

const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10", 5: "10:00", 6: "10:50",
    7: "12:30", 8: "13:20", 9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40", 17: "21:30", 18: "22:20"
};

const GOOGLE_COLORS = {
    "ly-thuyet": "1",
    "thuc-hanh": "2",
    "truc-tuyen": "7",
    "thi": "11",
    "tam-ngung": "8"
};

function $(id) {
    return document.getElementById(id);
}

function formatDiem(value, digits = 2) {
    return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(digits) : '-';
}

function scoreClassName(value) {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num <= 5 ? 'score-low' : 'score-normal';
}

function setScoreColorClass(el, value) {
    if (!el) return;
    el.classList.remove('score-low', 'score-normal');
    const cls = scoreClassName(value);
    if (cls) el.classList.add(cls);
}

function setGradeLetterClass(el, chu) {
    if (!el) return;
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
            break;
    }
}

function roundGPA(sumDiem, tongTC) {
    if (!tongTC) return '0.00';
    return (Math.round((sumDiem / tongTC) * 100) / 100).toFixed(2);
}

function getXepLoaiHocLuc(gpa4) {
    if (gpa4 >= 3.6) return 'Xuất sắc';
    if (gpa4 >= 3.2) return 'Giỏi';
    if (gpa4 >= 2.5) return 'Khá';
    if (gpa4 >= 2.0) return 'Trung bình';
    if (gpa4 >= 1.0) return 'Yếu';
    return 'Kém';
}

function quyDoiHeChuVaHe4(diem10, isTotNghiep = false) {
    if (diem10 === null || diem10 === undefined || isNaN(diem10)) {
        return { chu: '', he4: null, xepLoai: '', isDat: false };
    }

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

function tinhDiemTongKet({ tkVals, thVals, diemGK, diemThi, soTC, isTotNghiep, isThucHanhThuan, isTichHop }) {
    const diemTK_TongKet = tkVals.length > 0 ? lamTronDiemIUH(tkVals.reduce((a, b) => a + b, 0) / tkVals.length) : null;
    const diemTH_TongKet = thVals.length > 0 ? lamTronDiemIUH(thVals.reduce((a, b) => a + b, 0) / thVals.length) : null;

    if (isTotNghiep) {
        return diemThi !== null ? diemThi : null;
    }

    if (isThucHanhThuan) {
        return diemTH_TongKet;
    }

    if (isTichHop) {
        const diemLT = (diemThi !== null && diemThi < 3.0)
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

    if (diemThi !== null && diemThi < 3.0) return diemThi;
    if (diemThi !== null && diemGK !== null && diemTK_TongKet !== null) {
        return parseFloat((0.5 * diemThi + 0.3 * diemGK + 0.2 * diemTK_TongKet).toFixed(1));
    }

    return null;
}

function resetProgressText() {
    const val = $('val-tin-chi');
    const lbl = $('lbl-tin-chi');
    if (!val || !lbl) return;
    val.innerText = `${progressState.current}/${progressState.total}`;
    val.style.color = '#f8fafc';
    lbl.innerText = 'Tín chỉ';
}

function updateProgressDisplay() {
    const circleCurrent = $('svg-circle-current');
    if (!circleCurrent) return;
    const percent = progressState.total ? Math.min(progressState.current / progressState.total, 1) : 0;
    circleCurrent.style.strokeDashoffset = (2 * Math.PI * 35) - percent * (2 * Math.PI * 35);
    resetProgressText();
}

function renderProgressChart(creditInfo) {
    progressState.current = creditInfo ? creditInfo.current : 0;
    progressState.total = creditInfo ? creditInfo.total : 130;

    const circleTotal = $('svg-circle-total');
    const circleCurrent = $('svg-circle-current');
    if (!circleTotal || !circleCurrent) return;

    const C_OUTER = 2 * Math.PI * 50;
    const C_INNER = 2 * Math.PI * 35;

    circleTotal.style.strokeDasharray = C_OUTER;
    circleTotal.style.strokeDashoffset = 0;
    circleCurrent.style.strokeDasharray = C_INNER;
    circleCurrent.style.strokeDashoffset = C_INNER;

    updateProgressDisplay();

    circleTotal.onmouseenter = () => {
        const val = $('val-tin-chi');
        const lbl = $('lbl-tin-chi');
        if (!val || !lbl) return;
        val.innerText = progressState.total;
        val.style.color = '#00a8ff';
        lbl.innerText = 'Tổng TC';
    };

    circleCurrent.onmouseenter = () => {
        const val = $('val-tin-chi');
        const lbl = $('lbl-tin-chi');
        if (!val || !lbl) return;
        const percent = progressState.total ? Math.min(progressState.current / progressState.total, 1) : 0;
        val.innerText = `${(percent * 100).toFixed(1)}%`;
        val.style.color = '#32cd32';
        lbl.innerText = 'Hoàn thành';
    };

    circleTotal.onmouseleave = resetProgressText;
    circleCurrent.onmouseleave = resetProgressText;
}

function buildScoreInputCell(value, extraClass) {
    const v = value !== null && value !== undefined ? value : '';
    const classes = ['edit-input', extraClass, scoreClassName(v)].filter(Boolean).join(' ');
    return `<td class="text-center" style="padding: 4px;">
        <input type="number" step="0.1" class="${classes}" value="${v}" data-ori-val="${v}">
    </td>`;
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

    const tkHtml = Array.from({ length: 6 }, (_, i) =>
        buildScoreInputCell(sub.tk && sub.tk[i] !== undefined ? sub.tk[i] : null, 'tk-input')
    ).join('');
    const thHtml = Array.from({ length: 4 }, (_, i) =>
        buildScoreInputCell(sub.th && sub.th[i] !== undefined ? sub.th[i] : null, 'th-input')
    ).join('');

    tr.innerHTML = `
        <td>${sub.maHP}</td>
        <td class="font-medium">${sub.tenHP}${sub.isExcludedFromGPA ? '<br><span style="font-size: 10px; color: var(--text-muted);">(Không tính GPA)</span>' : ''}</td>
        <td class="text-center font-bold">${sub.soTC}</td>
        ${tkHtml}
        ${thHtml}
        ${buildScoreInputCell(sub.diemGK, 'gk-input')}
        ${buildScoreInputCell(sub.diemThi, 'ck-input')}
        <td class="text-center font-bold cell-he10">${formatDiem(sub.diem10)}</td>
        <td class="text-center font-bold cell-he4">${formatDiem(sub.diem4)}</td>
        <td class="text-center font-bold cell-chu">${sub.diemChu || '-'}</td>
        <td class="text-center font-medium cell-xl">${sub.xepLoai || '-'}</td>
        <td class="text-center cell-dat">${sub.isDat ? '<span style="color: var(--success);">✅</span>' : '<span style="color: var(--danger);">❌</span>'}</td>
    `;

    setScoreColorClass(tr.querySelector('.cell-he10'), sub.diem10);
    setScoreColorClass(tr.querySelector('.cell-he4'), sub.diem10);
    setGradeLetterClass(tr.querySelector('.cell-chu'), sub.diemChu);

    tr.querySelectorAll('.edit-input').forEach(inp => {
        inp.addEventListener('input', () => simulateRowCalculation(tr));
    });

    return tr;
}

function renderSemesters(semesters) {
    const tbody = $('grade-table-body');
    if (!tbody) return;

    semesters.forEach((sem, semIndex) => {
        if (!sem.subjects || !sem.subjects.length) return;

        const header = document.createElement('tr');
        header.innerHTML = `<td colspan="20" style="background: rgba(59, 130, 246, 0.1); color: var(--primary); font-weight: bold;">📚 ${sem.semesterName}</td>`;
        tbody.appendChild(header);

        sem.subjects.forEach(sub => tbody.appendChild(buildSubjectRow(sub, semIndex)));

        const summary = document.createElement('tr');
        summary.innerHTML = `
            <td colspan="20" style="background-color: rgba(255,255,255,0.02); padding: 16px 24px; border-bottom: 2px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13.5px; color: var(--text-muted);">
                    <div><span style="color: var(--text-main);">TB Học kỳ (Hệ 10):</span> <strong class="text-orange" id="sem-gpa10-${semIndex}">--</strong></div>
                    <div><span style="color: var(--text-main);">TB Học kỳ (Hệ 4):</span> <strong class="text-orange" id="sem-gpa4-${semIndex}">--</strong></div>
                    <div><span style="color: var(--text-main);">TB Tích lũy (Hệ 10):</span> <strong class="text-orange" id="cum-gpa10-${semIndex}">--</strong></div>
                    <div><span style="color: var(--text-main);">TB Tích lũy (Hệ 4):</span> <strong class="text-orange" id="cum-gpa4-${semIndex}">--</strong></div>
                </div>
            </td>`;
        tbody.appendChild(summary);
    });
}

function renderDashboard(data) {
    const tbody = $('grade-table-body');
    if (!tbody || !data) return;
    tbody.innerHTML = '';
    renderProgressChart(data.creditInfo);
    renderSemesters(data.semesters || []);
    recalculateOverallGPA();
}

function simulateRowCalculation(tr) {
    const readInputs = selector =>
        Array.from(tr.querySelectorAll(selector))
            .map(inp => parseFloat(inp.value))
            .filter(v => !isNaN(v));

    const gkInput = tr.querySelector('.gk-input');
    const ckInput = tr.querySelector('.ck-input');

    const diemGK = gkInput && !isNaN(parseFloat(gkInput.value)) ? parseFloat(gkInput.value) : null;
    const diemThi = ckInput && !isNaN(parseFloat(ckInput.value)) ? parseFloat(ckInput.value) : null;

    const diem10 = tinhDiemTongKet({
        tkVals: readInputs('.tk-input'),
        thVals: readInputs('.th-input'),
        diemGK,
        diemThi,
        soTC: parseInt(tr.dataset.tc, 10),
        isTotNghiep: tr.dataset.istotnghiep === 'true',
        isThucHanhThuan: tr.dataset.isthuchanhthuan === 'true',
        isTichHop: tr.dataset.istichhop === 'true'
    });

    const quyDoi = diem10 !== null
        ? quyDoiHeChuVaHe4(diem10, tr.dataset.istotnghiep === 'true')
        : { chu: '', he4: null, xepLoai: '', isDat: false };

    let isRowModified = false;
    tr.querySelectorAll('.edit-input').forEach(inp => {
        if (inp.value !== inp.getAttribute('data-ori-val')) {
            isRowModified = true;
        }
        setScoreColorClass(inp, inp.value);
    });

    if (isRowModified) tr.classList.add('modified-row');
    else tr.classList.remove('modified-row');

    const he10Cell = tr.querySelector('.cell-he10');
    const he4Cell = tr.querySelector('.cell-he4');
    const chuCell = tr.querySelector('.cell-chu');
    const xlCell = tr.querySelector('.cell-xl');
    const datCell = tr.querySelector('.cell-dat');

    if (he10Cell) he10Cell.innerText = formatDiem(diem10);
    if (he4Cell) he4Cell.innerText = formatDiem(quyDoi.he4);
    if (chuCell) chuCell.innerText = quyDoi.chu || '-';
    if (xlCell) xlCell.innerText = quyDoi.xepLoai || '-';
    if (datCell) {
        datCell.innerHTML = quyDoi.isDat
            ? '<span style="color: var(--success); font-size: 16px;">✅</span>'
            : '<span style="color: var(--danger); font-size: 16px;">❌</span>';
    }

    setScoreColorClass(he10Cell, diem10);
    setScoreColorClass(he4Cell, diem10);
    setGradeLetterClass(chuCell, quyDoi.chu);

    recalculateOverallGPA();
}

function computeSemesterAggregates(semIndex, globalHistory) {
    const semRows = document.querySelectorAll(`tr.subject-row[data-sem-idx="${semIndex}"]`);
    let semTC = 0;
    let semSum10 = 0;
    let semSum4 = 0;

    semRows.forEach(tr => {
        const maHP = tr.dataset.mahp;
        const isExcluded = tr.dataset.excluded === 'true';
        const soTC = parseInt(tr.dataset.tc, 10);
        const he10 = parseFloat(tr.querySelector('.cell-he10')?.innerText);
        const he4 = parseFloat(tr.querySelector('.cell-he4')?.innerText);
        const isDat = tr.querySelector('.cell-dat')?.innerHTML.includes('✅');

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
    const elSemGpa4 = $(`sem-gpa4-${semIndex}`);
    const elSemXl = $(`sem-xl-${semIndex}`);
    const elCumGpa10 = $(`cum-gpa10-${semIndex}`);
    const elCumGpa4 = $(`cum-gpa4-${semIndex}`);
    const elCumXl = $(`cum-xl-${semIndex}`);

    if (elSemGpa10) elSemGpa10.innerText = sGpa10;
    if (elSemGpa4) elSemGpa4.innerText = sGpa4;
    if (elSemXl) elSemXl.innerText = getXepLoaiHocLuc(parseFloat(sGpa4));

    if (elCumGpa10) elCumGpa10.innerText = cGpa10;
    if (elCumGpa4) elCumGpa4.innerText = cGpa4;
    if (elCumXl) elCumXl.innerText = getXepLoaiHocLuc(parseFloat(cGpa4));
}

function recalculateOverallGPA() {
    if (!globalDashboardData) return;

    const globalHistory = {};
    let totalTCDatOverall = 0;
    const numSemesters = (globalDashboardData.semesters || []).length;

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

    progressState.current = totalTCDatOverall;
    updateProgressDisplay();

    const valGpa10 = $('val-gpa-10');
    const valGpa4 = $('val-gpa-4');
    if (valGpa10) valGpa10.innerText = roundGPA(finalCumSum10, finalCumTC);
    if (valGpa4) valGpa4.innerText = roundGPA(finalCumSum4, finalCumTC);
}

function triggerSync() {
    const btnSync = $('btn-sync-grades');
    const tbody = $('grade-table-body');

    if (!tbody) return;

    if (btnSync) {
        btnSync.innerHTML = `<span class="icon">⏳</span> Đang đồng bộ...`;
        btnSync.style.pointerEvents = 'none';
    }

    tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium">Đang tải và phân tích dữ liệu từ trường...</td></tr>`;

    fetchAndProcessGrades().then(data => {
        if (btnSync) btnSync.style.pointerEvents = 'auto';

        if (data === 'REQUIRE_LOGIN' || data === 'AUTH_REQUIRED') {
            tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-orange">Phiên đăng nhập hết hạn. Đang mở lại phiên ngầm...</td></tr>`;
            if (btnSync) btnSync.innerHTML = `<span class="icon">🔑</span> Đang khôi phục...`;

            chrome.runtime.sendMessage({ action: "renewSessionViaGhostTab" }, (response) => {
                if (chrome.runtime.lastError) {
                    tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-red">Lỗi kết nối nội bộ. Hãy tải lại trang Dashboard.</td></tr>`;
                    if (btnSync) btnSync.innerHTML = `<span class="icon">❌</span> Thất bại`;
                    return;
                }
                if (response && response.success) {
                    triggerSync();
                } else {
                    // [SỬA LỖI VÒNG LẶP] Xử lý khi đăng nhập ngầm thất bại
                    tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-red">Đăng nhập tự động thất bại. Vui lòng kiểm tra lại tài khoản.</td></tr>`;
                    if (btnSync) {
                        btnSync.style.pointerEvents = 'auto';
                        btnSync.innerHTML = `<span class="icon">❌</span> Thất bại`;
                    }
                }
            });
            return;
        }

        if (!data) {
            tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium score-low">Lỗi kết nối. Vui lòng thử lại sau.</td></tr>`;
            if (btnSync) btnSync.innerHTML = `<span class="icon">❌</span> Lỗi mạng`;
            return;
        }

        globalDashboardData = data;
        renderDashboard(data);

        if (btnSync) {
            btnSync.innerHTML = `<span class="icon">✅</span> Đã cập nhật`;
            setTimeout(() => {
                btnSync.innerHTML = `<span class="icon">🔄</span> Làm mới dữ liệu gốc`;
            }, 3000);
        }
    }).catch(() => {
        tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium score-low">Có lỗi khi xử lý dữ liệu.</td></tr>`;
        if (btnSync) {
            btnSync.style.pointerEvents = 'auto';
            btnSync.innerHTML = `<span class="icon">❌</span> Thất bại`;
        }
    });
}

function loadSettingsToForm() {
    const txtWebApp = $('setting-webapp-url');
    const txtUser = $('setting-user');
    const txtPass = $('setting-pass');
    const chkAutoFill = $('setting-auto-fill');
    const chkAutoLogin = $('setting-auto-login');
    const selColorDirect = $('setting-color-direct');
    const selColorOnline = $('setting-color-online');
    const selColorPractice = $('setting-color-practice');
    const selColorPostponed = $('setting-color-postponed');
    const selColorExam = $('setting-color-exam');

    chrome.storage.sync.get([
        'webAppUrl',
        'iuhUser',
        'iuhPass',
        'autoFillInfo',
        'autoClickLogin',
        'calendarColorDirect',
        'calendarColorOnline',
        'calendarColorPractice',
        'calendarColorPostponed',
        'calendarColorExam'
    ], (result) => {
        if (txtWebApp) txtWebApp.value = result.webAppUrl || '';
        if (txtUser) txtUser.value = result.iuhUser || '';
        if (txtPass) txtPass.value = result.iuhPass || '';
        if (chkAutoFill) chkAutoFill.checked = result.autoFillInfo !== false;
        if (chkAutoLogin) chkAutoLogin.checked = result.autoClickLogin !== false;

        if (selColorDirect) selColorDirect.value = result.calendarColorDirect || '9';
        if (selColorOnline) selColorOnline.value = result.calendarColorOnline || '7';
        if (selColorPractice) selColorPractice.value = result.calendarColorPractice || '2';
        if (selColorPostponed) selColorPostponed.value = result.calendarColorPostponed || '8';
        if (selColorExam) selColorExam.value = result.calendarColorExam || '11';
    });
}

function saveSettingsFromForm() {
    const txtWebApp = $('setting-webapp-url');
    const txtUser = $('setting-user');
    const txtPass = $('setting-pass');
    const chkAutoFill = $('setting-auto-fill');
    const chkAutoLogin = $('setting-auto-login');
    const selColorDirect = $('setting-color-direct');
    const selColorOnline = $('setting-color-online');
    const selColorPractice = $('setting-color-practice');
    const selColorPostponed = $('setting-color-postponed');
    const selColorExam = $('setting-color-exam');
    const btnSaveSettings = $('btn-save-settings');

    if (!txtWebApp || !txtUser || !txtPass || !chkAutoFill || !chkAutoLogin) return;

    const dataToSave = {
        webAppUrl: txtWebApp.value.trim(),
        iuhUser: txtUser.value.trim(),
        iuhPass: txtPass.value,
        autoFillInfo: chkAutoFill.checked,
        autoClickLogin: chkAutoLogin.checked,
        calendarColorDirect: selColorDirect ? selColorDirect.value : '9',
        calendarColorOnline: selColorOnline ? selColorOnline.value : '7',
        calendarColorPractice: selColorPractice ? selColorPractice.value : '2',
        calendarColorPostponed: selColorPostponed ? selColorPostponed.value : '8',
        calendarColorExam: selColorExam ? selColorExam.value : '11'
    };

    chrome.storage.sync.set(dataToSave, () => {
        if (btnSaveSettings) {
            const oldText = btnSaveSettings.innerText;
            btnSaveSettings.innerText = '✅ Đã cấu hình hệ thống thành công!';
            btnSaveSettings.style.background = 'var(--success)';
            setTimeout(() => {
                btnSaveSettings.innerText = oldText || '💾 Lưu cấu hình hệ thống';
                btnSaveSettings.style.background = 'var(--primary)';
            }, 2000);
        }
    });
}

function initSurveyWidget() {
    const navSurvey = $('nav-survey');
    if (!navSurvey) return;

    let surveyProgressContainer = $('survey-progress-container');
    if (!surveyProgressContainer) {
        surveyProgressContainer = document.createElement('div');
        surveyProgressContainer.id = 'survey-progress-container';
        surveyProgressContainer.style.display = 'none';
        surveyProgressContainer.style.marginTop = '8px';
        surveyProgressContainer.style.padding = '12px';
        surveyProgressContainer.style.background = 'rgba(40, 167, 69, 0.1)';
        surveyProgressContainer.style.border = '1px solid #28a745';
        surveyProgressContainer.style.borderRadius = '8px';
        surveyProgressContainer.style.fontSize = '12px';
        surveyProgressContainer.style.color = 'var(--text-main)';
        surveyProgressContainer.innerHTML = `
            <div style="font-weight: bold; color: #28a745; margin-bottom: 6px;">🔄 Tiến trình Khảo sát:</div>
            <div id="survey-progress-text" style="margin-bottom: 6px;">Đang quét dữ liệu...</div>
            <div style="background: var(--bg-dark); border-radius: 4px; height: 10px; width: 100%; overflow: hidden;">
                <div id="survey-progress-bar" style="background: var(--warning); width: 100%; height: 100%; transition: width 0.3s;"></div>
            </div>
        `;
        navSurvey.parentNode.insertBefore(surveyProgressContainer, navSurvey.nextSibling);
    }

    navSurvey.addEventListener('click', (e) => {
        e.preventDefault();

        const navGrades = $('nav-grades');
        const navSchedule = $('nav-schedule');
        const navSurveyBtn = $('nav-survey');
        const navSettings = $('nav-settings');
        [navGrades, navSchedule, navSurveyBtn, navSettings].forEach(n => n && n.classList.remove('active'));
        navSurveyBtn && navSurveyBtn.classList.add('active');

        if (confirm("Extension sẽ tự động chọn mức 'Bình thường' và điền form cho TẤT CẢ các phiếu khảo sát chưa làm. Bạn có muốn tiếp tục?")) {
            chrome.storage.local.remove('iuh_survey_status', () => {
                chrome.storage.local.set({
                    iuh_auto_survey_running: true,
                    iuh_survey_current_index: 0,
                    iuh_survey_urls: []
                }, () => {
                    chrome.runtime.sendMessage({ action: "triggerAutoSurvey" });
                });
            });
        }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        if (!(changes.iuh_survey_current_index || changes.iuh_survey_urls || changes.iuh_survey_status || changes.iuh_auto_survey_running)) return;

        chrome.storage.local.get(['iuh_auto_survey_running', 'iuh_survey_current_index', 'iuh_survey_urls', 'iuh_survey_status'], (data) => {
            const isRunning = data.iuh_auto_survey_running;
            const current = data.iuh_survey_current_index || 0;
            const urls = data.iuh_survey_urls || [];
            const total = urls.length;
            const status = data.iuh_survey_status;

            if (isRunning) {
                surveyProgressContainer.style.display = 'block';
                if (total === 0) {
                    $('survey-progress-text').innerText = 'Đang tải danh sách khảo sát...';
                    $('survey-progress-bar').style.width = '100%';
                    $('survey-progress-bar').style.background = 'var(--warning)';
                } else {
                    const percent = Math.round((current / total) * 100);
                    $('survey-progress-text').innerText = `Đang xử lý môn số ${current}/${total} (${percent}%)`;
                    $('survey-progress-bar').style.width = `${percent}%`;
                    $('survey-progress-bar').style.background = '#28a745';
                }
            } else {
                surveyProgressContainer.style.display = 'none';
                if (status === 'NO_SURVEYS') {
                    alert("🎉 Tuyệt vời! Bạn không còn phiếu khảo sát học phần nào cần làm.");
                    chrome.storage.local.remove('iuh_survey_status');
                } else if (status === 'DONE') {
                    alert("✅ Hoàn tất! Đã tự động điền xong toàn bộ phiếu khảo sát.");
                    chrome.storage.local.remove('iuh_survey_status');
                }
            }
        });
    });
}

function initScheduleModal() {
    const navSchedule = $('nav-schedule');
    const modalWeeks = $('modal-weeks-sync');
    const weeksInput = $('sync-weeks-input');
    const btnCloseWeeksModal = $('btn-close-weeks-modal');
    const btnSubmitWeeksModal = $('btn-submit-weeks-modal');

    if (!navSchedule || !modalWeeks || !weeksInput || !btnCloseWeeksModal || !btnSubmitWeeksModal) return;

    navSchedule.addEventListener('click', (e) => {
        e.preventDefault();
        const navGrades = $('nav-grades');
        const navSurvey = $('nav-survey');
        const navSettings = $('nav-settings');
        [navGrades, navSchedule, navSurvey, navSettings].forEach(n => n && n.classList.remove('active'));
        navSchedule.classList.add('active');

        modalWeeks.style.display = 'flex';
        weeksInput.value = '5';
        weeksInput.focus();
        weeksInput.select();
    });

    const closeWeeksModal = () => {
        modalWeeks.style.display = 'none';
    };

    btnCloseWeeksModal.addEventListener('click', closeWeeksModal);
    modalWeeks.addEventListener('click', (e) => {
        if (e.target === modalWeeks) closeWeeksModal();
    });

    let isExecutingSync = false;
    function executeScheduleSync() {
        if (isExecutingSync) return;
        isExecutingSync = true;

        const originalBtnText = btnSubmitWeeksModal.innerText;
        btnSubmitWeeksModal.innerText = '⏳ Đang khởi động...';
        btnSubmitWeeksModal.style.opacity = '0.7';

        const totalWeeks = parseInt(weeksInput.value, 10) || 5;

        chrome.storage.local.set({
            iuh_sync_weeks_count: totalWeeks,
            iuh_auto_sync_active: true
        }, () => {
            chrome.runtime.sendMessage({ action: "triggerManualScheduleSync" });
            closeWeeksModal();

            setTimeout(() => {
                isExecutingSync = false;
                btnSubmitWeeksModal.innerText = originalBtnText;
                btnSubmitWeeksModal.style.opacity = '1';
            }, 2000);
        });
    }

    btnSubmitWeeksModal.addEventListener('click', executeScheduleSync);
    weeksInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeScheduleSync();
        }
    });
}

function initSettingsUI() {
    const navGrades = $('nav-grades');
    const navSchedule = $('nav-schedule');
    const navSurvey = $('nav-survey');
    const navSettings = $('nav-settings');

    const tabGrades = $('tab-content-grades');
    const tabSettings = $('tab-content-settings');

    const btnToggleReg = $('btn-toggle-reg');
    const regPanel = $('reg-panel');

    const btnTogglePassword = $('btn-toggle-password');
    const txtPass = $('setting-pass');

    const iconEyeVisible = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const iconEyeHidden = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    document.querySelectorAll('.color-select-input').forEach(select => {
        select.innerHTML = GOOGLE_COLOR_OPTIONS_HTML;
    });

    function switchActiveNav(activeId) {
        [navGrades, navSchedule, navSurvey, navSettings].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });

        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('active');
    }

    function switchTab(tabName) {
        if (!tabGrades || !tabSettings) return;

        switchActiveNav(`nav-${tabName}`);

        if (tabName === 'grades') {
            tabGrades.style.display = 'block';
            tabSettings.style.display = 'none';
        } else if (tabName === 'settings') {
            tabGrades.style.display = 'none';
            tabSettings.style.display = 'block';
            loadSettingsToForm();
        }
    }

    if (btnToggleReg && regPanel) {
        btnToggleReg.addEventListener('click', () => {
            regPanel.classList.toggle('show');
            btnToggleReg.innerText = regPanel.classList.contains('show') ? '✕' : 'i';
        });
    }

    if (btnTogglePassword && txtPass) {
        btnTogglePassword.innerHTML = iconEyeHidden;

        btnTogglePassword.addEventListener('click', () => {
            if (txtPass.type === 'password') {
                txtPass.type = 'text';
                btnTogglePassword.innerHTML = iconEyeVisible;
                btnTogglePassword.title = 'Ẩn mật khẩu';
            } else {
                txtPass.type = 'password';
                btnTogglePassword.innerHTML = iconEyeHidden;
                btnTogglePassword.title = 'Hiện mật khẩu';
            }
        });

        btnTogglePassword.addEventListener('mouseenter', () => {
            btnTogglePassword.style.color = '#fff';
        });

        btnTogglePassword.addEventListener('mouseleave', () => {
            btnTogglePassword.style.color = 'var(--text-muted)';
        });
    }

    if (navGrades) {
        navGrades.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('grades');
            // [SỬA ĐỂ ĐÚNG FLOW] Nếu chuyển sang tab Bảng điểm mà chưa có data thì tự gọi triggerSync()
            if (!globalDashboardData) {
                triggerSync();
            }
        });
    }

    if (navSettings) {
        navSettings.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('settings');
        });
    }

    if (navSurvey) {
        initSurveyWidget();
    }

    initScheduleModal();

    const btnSaveSettings = $('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', saveSettingsFromForm);
    }

    chrome.storage.local.get(['iuh_grade_data'], result => {
        if (result.iuh_grade_data) {
            globalDashboardData = result.iuh_grade_data;
            renderDashboard(globalDashboardData);
        } else {
            // [SỬA LỖI AUTO LOGIN] Tắt tự động gọi triggerSync() ở đây
            // Khi người dùng mở giao diện, nếu không có data thì yêu cầu bấm nút để đồng bộ
            const tbody = $('grade-table-body');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-orange">Chưa có dữ liệu bảng điểm. Vui lòng bấm "Làm mới dữ liệu gốc" để lấy điểm từ hệ thống.</td></tr>`;
            }
        }
    });

    const btnSyncGrades = $('btn-sync-grades');
    if (btnSyncGrades) {
        btnSyncGrades.addEventListener('click', triggerSync);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSettingsUI();
    loadSettingsToForm();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'sessionRenewedSuccessfully') {
            triggerSync();
        }
    });
});