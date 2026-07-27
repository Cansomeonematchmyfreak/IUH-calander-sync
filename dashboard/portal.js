// dashboard/portal.js
'use strict';

let globalDashboardData = null;
let progressState = { current: 0, total: 130 };

/* ============================================================
   1. HẰNG SỐ & TIỆN ÍCH DÙNG CHUNG
   ============================================================ */
const SVG_R_OUTER = 50, SVG_R_INNER = 35;
const C_OUTER = 2 * Math.PI * SVG_R_OUTER, C_INNER = 2 * Math.PI * SVG_R_INNER;

function $(id) { return document.getElementById(id); }

function formatDiem(value, digits = 2) { return value !== null && value !== undefined && !isNaN(value) ? value.toFixed(digits) : '-'; }
function scoreClassName(value) {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num <= 5 ? 'score-low' : 'score-normal';
}
function setScoreColorClass(el, value) {
    el.classList.remove('score-low', 'score-normal');
    const cls = scoreClassName(value);
    if (cls) el.classList.add(cls);
}
function setGradeLetterClass(el, chu) {
    el.classList.remove('grade-a', 'grade-b', 'grade-c', 'grade-d', 'grade-f');
    switch (chu) {
        case 'A+': case 'A': el.classList.add('grade-a'); break;
        case 'B+': case 'B': el.classList.add('grade-b'); break;
        case 'C+': case 'C': el.classList.add('grade-c'); break;
        case 'D+': case 'D': el.classList.add('grade-d'); break;
        default: el.classList.add('grade-f');
    }
}

/* ============================================================
   2. QUY ĐỔI ĐIỂM & TÍNH TOÁN
   ============================================================ */
function roundGPA(sumDiem, tongTC) { return tongTC ? (Math.round((sumDiem / tongTC) * 100) / 100).toFixed(2) : '0.00'; }
function getXepLoaiHocLuc(gpa4) {
    if (gpa4 >= 3.6) return 'Xuất sắc'; if (gpa4 >= 3.2) return 'Giỏi';
    if (gpa4 >= 2.5) return 'Khá'; if (gpa4 >= 2.0) return 'Trung bình';
    if (gpa4 >= 1.0) return 'Yếu'; return 'Kém';
}
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

function tinhDiemTongKet({ tkVals, thVals, diemGK, diemThi, soTC, isTotNghiep, isThucHanhThuan, isTichHop }) {
    const diemTK = tkVals.length > 0 ? lamTronDiemIUH(tkVals.reduce((a, b) => a + b, 0) / tkVals.length) : null;
    
    // 🚨 RÀNG BUỘC 1: Vắng 1 buổi Thực hành (có 1 cột 0đ) -> Rớt toàn bộ môn (Cấm thi)
    let diemTH = null;
    if (thVals.length > 0) {
        if (thVals.includes(0)) {
            diemTH = 0.0; // Ép điểm TH về 0 ngay lập tức
        } else {
            diemTH = lamTronDiemIUH(thVals.reduce((a, b) => a + b, 0) / thVals.length);
        }
    }

    // Xử lý môn Đồ án / Khóa luận tốt nghiệp
    if (isTotNghiep) {
        return diemThi !== null ? diemThi : null;
    }

    // Xử lý môn chỉ có Thực hành (Thể dục, GDQP...)
    if (isThucHanhThuan) {
        return diemTH;
    }

    // Xử lý môn Tích hợp (Lý thuyết + Thực hành)
    if (isTichHop) {
        // 🚨 RÀNG BUỘC 2: Điểm thi cuối kỳ < 3.0 là ĐIỂM LIỆT, không cần tính trung bình
        const diemLT = (diemThi !== null && diemThi < 3.0) 
            ? diemThi 
            : lamTronDiemIUH(0.5 * (diemThi || 0) + 0.3 * (diemGK || 0) + 0.2 * (diemTK || 0));

        // 🚨 CHỐT CHẶN: Nếu Thực hành liệt (< 3.0) HOẶC Lý thuyết liệt (< 3.0) -> Ép rớt môn
        if ((diemTH !== null && diemTH < 3.0) || (diemLT !== null && diemLT < 3.0)) {
            // Trả về điểm thấp nhất để hệ thống quy đổi ra F (Rớt)
            return diemThi !== null ? Math.min(diemLT, diemTH !== null ? diemTH : 0) : 0.0;
        }

        // Nếu qua hết các ải điểm liệt -> Tính trung bình tín chỉ
        if (diemTH !== null && diemThi !== null) {
            const j_lt = soTC > 1 ? soTC - 1 : 1; // Trọng số tín chỉ lý thuyết
            const j_th = 1;                       // Trọng số tín chỉ thực hành
            return parseFloat((((diemLT * j_lt) + diemTH) / soTC).toFixed(1));
        }
        return null;
    }

    // Xử lý môn Lý thuyết thông thường
    if (diemThi !== null && diemThi < 3.0) {
        return diemThi; // Bắt điểm liệt cuối kỳ
    }
    if (diemThi !== null && diemGK !== null && diemTK !== null) {
        return parseFloat((0.5 * diemThi + 0.3 * diemGK + 0.2 * diemTK).toFixed(1));
    }
    
    return null;
}

/* ============================================================
   3. RENDER UI BẢNG ĐIỂM & SVG
   ============================================================ */
function resetProgressText() {
    $('val-tin-chi').innerText = `${progressState.current}/${progressState.total}`;
    $('val-tin-chi').style.color = '#f8fafc';
    $('lbl-tin-chi').innerText = 'Tín chỉ';
}
function updateProgressDisplay() {
    const percent = progressState.total ? Math.min(progressState.current / progressState.total, 1) : 0;
    $('svg-circle-current').style.strokeDashoffset = C_INNER - percent * C_INNER;
    resetProgressText();
}
function renderProgressChart(creditInfo) {
    progressState.current = creditInfo ? creditInfo.current : 0;
    progressState.total = creditInfo ? creditInfo.total : 130;
    $('svg-circle-total').style.strokeDasharray = C_OUTER;
    $('svg-circle-total').style.strokeDashoffset = 0;
    $('svg-circle-current').style.strokeDasharray = C_INNER;
    updateProgressDisplay();
}

function buildScoreInputCell(value, extraClass) {
    const v = value !== null && value !== undefined ? value : '';
    const classes = ['edit-input', extraClass, scoreClassName(v)].filter(Boolean).join(' ');
    // 🚨 THÊM data-ori-val="${v}" ĐỂ LƯU GIỮ GIÁ TRỊ GỐC LÚC MỚI RENDER
    return `<td class="text-center" style="padding: 4px;"><input type="number" step="0.1" class="${classes}" value="${v}" data-ori-val="${v}"></td>`;
}
function buildSubjectRow(sub, semIndex) {
    const tr = document.createElement('tr');
    tr.className = 'subject-row';
    tr.dataset.semIdx = semIndex; tr.dataset.mahp = sub.maHP; tr.dataset.tc = sub.soTC;
    tr.dataset.excluded = sub.isExcludedFromGPA; tr.dataset.istichhop = sub.isTichHop;
    tr.dataset.isthuchanhthuan = sub.isThucHanhThuan; tr.dataset.istotnghiep = sub.isTotNghiep;

    const tkHtml = Array.from({ length: 6 }, (_, i) => buildScoreInputCell(sub.tk && sub.tk[i] !== undefined ? sub.tk[i] : null, 'tk-input')).join('');
    const thHtml = Array.from({ length: 4 }, (_, i) => buildScoreInputCell(sub.th && sub.th[i] !== undefined ? sub.th[i] : null, 'th-input')).join('');

    tr.innerHTML = `
        <td>${sub.maHP}</td>
        <td class="font-medium">${sub.tenHP}${sub.isExcludedFromGPA ? `<br><span style="font-size: 10px; color: var(--text-muted);">(Không tính GPA)</span>` : ''}</td>
        <td class="text-center font-bold">${sub.soTC}</td>
        ${tkHtml}${thHtml}
        ${buildScoreInputCell(sub.diemGK, 'gk-input')}${buildScoreInputCell(sub.diemThi, 'ck-input')}
        <td class="text-center font-bold cell-he10">${formatDiem(sub.diem10)}</td>
        <td class="text-center font-bold cell-he4">${formatDiem(sub.diem4)}</td>
        <td class="text-center font-bold cell-chu">${sub.diemChu || '-'}</td>
        <td class="text-center font-medium cell-xl">${sub.xepLoai || '-'}</td>
        <td class="text-center cell-dat">${sub.isDat ? '<span style="color: var(--success);">✅</span>' : '<span style="color: var(--danger);">❌</span>'}</td>
    `;
    setScoreColorClass(tr.querySelector('.cell-he10'), sub.diem10);
    setScoreColorClass(tr.querySelector('.cell-he4'), sub.diem10);
    setGradeLetterClass(tr.querySelector('.cell-chu'), sub.diemChu);
    tr.querySelectorAll('.edit-input').forEach(inp => inp.addEventListener('input', () => simulateRowCalculation(tr)));
    return tr;
}
function renderSemesters(semesters) {
    const tbody = $('grade-table-body');
    semesters.forEach((sem, semIndex) => {
        if (!sem.subjects.length) return;
        const trH = document.createElement('tr'); trH.innerHTML = `<td colspan="20" style="background: rgba(59, 130, 246, 0.1); color: var(--primary); font-weight: bold;">📚 ${sem.semesterName}</td>`;
        tbody.appendChild(trH);
        sem.subjects.forEach(sub => tbody.appendChild(buildSubjectRow(sub, semIndex)));
        const trS = document.createElement('tr');
        trS.innerHTML = `<td colspan="20" style="background-color: rgba(255, 255, 255, 0.02); padding: 16px 24px; border-bottom: 2px solid var(--border-color);"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13.5px; color: var(--text-muted);"><div><span style="color: var(--text-main);">TB Học kỳ (Hệ 10):</span> <strong class="text-orange" id="sem-gpa10-${semIndex}">--</strong></div><div><span style="color: var(--text-main);">TB Học kỳ (Hệ 4):</span> <strong class="text-orange" id="sem-gpa4-${semIndex}">--</strong></div><div><span style="color: var(--text-main);">TB Tích lũy (Hệ 10):</span> <strong class="text-orange" id="cum-gpa10-${semIndex}">--</strong></div><div><span style="color: var(--text-main);">TB Tích lũy (Hệ 4):</span> <strong class="text-orange" id="cum-gpa4-${semIndex}">--</strong></div></div></td>`;
        tbody.appendChild(trS);
    });
}
function renderDashboard(data) {
    $('grade-table-body').innerHTML = '';
    renderProgressChart(data.creditInfo);
    renderSemesters(data.semesters);
    recalculateOverallGPA();
}

/* ============================================================
   4. TÍNH TOÁN & MÔ PHỎNG REALTIME
   ============================================================ */
function simulateRowCalculation(tr) {
    const readInputs = selector => Array.from(tr.querySelectorAll(selector)).map(inp => parseFloat(inp.value)).filter(v => !isNaN(v));
    const diemGK = isNaN(parseFloat(tr.querySelector('.gk-input').value)) ? null : parseFloat(tr.querySelector('.gk-input').value);
    const diemThi = isNaN(parseFloat(tr.querySelector('.ck-input').value)) ? null : parseFloat(tr.querySelector('.ck-input').value);
    
    const diem10 = tinhDiemTongKet({
        tkVals: readInputs('.tk-input'), thVals: readInputs('.th-input'), diemGK, diemThi,
        soTC: parseInt(tr.dataset.tc, 10), isTotNghiep: tr.dataset.istotnghiep === 'true',
        isThucHanhThuan: tr.dataset.isthuchanhthuan === 'true', isTichHop: tr.dataset.istichhop === 'true'
    });
    const quyDoi = diem10 !== null ? quyDoiHeChuVaHe4(diem10, tr.dataset.istotnghiep === 'true') : { chu: '-', he4: null, xepLoai: '-', isDat: false };
    
    // 🚨 KIỂM TRA SỰ THAY ĐỔI ĐỂ BẬT/TẮT HIỆU ỨNG MÀU VÀNG & IN NGHIÊNG
    let isRowModified = false;
    tr.querySelectorAll('.edit-input').forEach(inp => {
        // So sánh giá trị hiện tại (value) với giá trị gốc (data-ori-val)
        if (inp.value !== inp.getAttribute('data-ori-val')) {
            isRowModified = true;
        }
        setScoreColorClass(inp, inp.value);
    });

    // Nếu có ô bị sửa -> Bật class vàng in nghiêng. Nếu giống hệt ban đầu -> Xóa class
    if (isRowModified) {
        tr.classList.add('modified-row');
    } else {
        tr.classList.remove('modified-row');
    }

    // Cập nhật DOM hiển thị kết quả
    tr.querySelector('.cell-he10').innerText = formatDiem(diem10);
    tr.querySelector('.cell-he4').innerText = formatDiem(quyDoi.he4);
    tr.querySelector('.cell-chu').innerText = quyDoi.chu;
    tr.querySelector('.cell-xl').innerText = quyDoi.xepLoai;
    tr.querySelector('.cell-dat').innerHTML = quyDoi.isDat ? '<span style="color: var(--success);">✅</span>' : '<span style="color: var(--danger);">❌</span>';
    
    setScoreColorClass(tr.querySelector('.cell-he10'), diem10); 
    setScoreColorClass(tr.querySelector('.cell-he4'), diem10); 
    setGradeLetterClass(tr.querySelector('.cell-chu'), quyDoi.chu);
    
    recalculateOverallGPA();
}

function recalculateOverallGPA() {
    if (!globalDashboardData) return;
    const history = {}; let totalTCDat = 0;
    
    for (let i = 0; i < globalDashboardData.semesters.length; i++) {
        let sTC = 0, s10 = 0, s4 = 0, cTC = 0, c10 = 0, c4 = 0;
        document.querySelectorAll(`tr.subject-row[data-sem-idx="${i}"]`).forEach(tr => {
            const h10 = parseFloat(tr.querySelector('.cell-he10').innerText), h4 = parseFloat(tr.querySelector('.cell-he4').innerText);
            const tc = parseInt(tr.dataset.tc, 10), excl = tr.dataset.excluded === 'true';
            if (isNaN(h10)) return;
            if (!excl) { sTC += tc; s10 += h10 * tc; s4 += h4 * tc; }
            if (!history[tr.dataset.mahp] || h10 > history[tr.dataset.mahp].he10) history[tr.dataset.mahp] = { he10: h10, he4: h4, soTC: tc, excl, dat: tr.querySelector('.cell-dat').innerHTML.includes('✅') };
        });
        Object.values(history).forEach(sub => { if (!sub.excl) { cTC += sub.soTC; c10 += sub.he10 * sub.soTC; c4 += sub.he4 * sub.soTC; } if(sub.dat) totalTCDat = cTC; });
        if($(`sem-gpa10-${i}`)) { $(`sem-gpa10-${i}`).innerText = roundGPA(s10, sTC); $(`sem-gpa4-${i}`).innerText = roundGPA(s4, sTC); $(`cum-gpa10-${i}`).innerText = roundGPA(c10, cTC); $(`cum-gpa4-${i}`).innerText = roundGPA(c4, cTC); }
    }
    
    let fTC = 0, f10 = 0, f4 = 0;
    Object.values(history).forEach(s => { if(!s.excl) { fTC += s.soTC; f10 += s.he10 * s.soTC; f4 += s.he4 * s.soTC; }});
    $('val-gpa-10').innerText = roundGPA(f10, fTC); $('val-gpa-4').innerText = roundGPA(f4, fTC);
}

/* ============================================================
   5. LOGIC FETCH ĐIỂM & XÁC THỰC AI
   ============================================================ */
let isSyncing = false;
function executeFetchGrades() {
    if (isSyncing) return; isSyncing = true;
    const btnSync = $('btn-sync-grades'), tbody = $('grade-table-body');
    if (btnSync) { btnSync.innerHTML = `<span class="icon">⏳</span> Đang cào dữ liệu...`; btnSync.style.pointerEvents = 'none'; }
    if (tbody) tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-blue">Đang tải và phân tích dữ liệu từ hệ thống trường...</td></tr>`;

    fetchAndProcessGrades().then(data => {
        isSyncing = false;
        if (btnSync) btnSync.style.pointerEvents = 'auto';
        
        if (data === 'AUTH_REQUIRED' || data === 'REQUIRE_LOGIN') {
            if (btnSync) btnSync.innerHTML = `<span class="icon">🔑</span> Đang khôi phục...`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-orange">Phiên đăng nhập hết hạn. Đang mở Ghost Tab nhờ AI giải Captcha tự động...</td></tr>`;
            
            // 🚨 SỬA TẠI ĐÂY: Đón trực tiếp câu trả lời của Background thông qua Callback
            chrome.runtime.sendMessage({ action: "renewSessionViaGhostTab" }, (response) => {
                // Bắt lỗi nếu Background bị ngắt kết nối
                if (chrome.runtime.lastError) {
                    console.error("[Dashboard] Lỗi giao tiếp:", chrome.runtime.lastError);
                    if (tbody) tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium text-danger">Lỗi kết nối nội bộ. Hãy F5 tải lại trang Dashboard!</td></tr>`;
                    if (btnSync) btnSync.innerHTML = `<span class="icon">❌</span> Thất bại`;
                    return;
                }
                
                // Nếu Background báo đã đăng nhập thành công -> Lập tức tự chạy lại lệnh fetch
                if (response && response.success) {
                    console.log("[Dashboard] Xác nhận đã có Cookie! Tự động cào điểm ngay...");
                    executeFetchGrades(); 
                }
            });
            return;
        }
        if (!data) {
            if (btnSync) btnSync.innerHTML = `<span class="icon">❌</span> Lỗi mạng`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="20" class="text-center font-medium score-low">Lỗi kết nối. Vui lòng thử lại sau.</td></tr>`;
            return;
        }
        globalDashboardData = data; renderDashboard(data);
        if (btnSync) btnSync.innerHTML = `<span class="icon">✅</span> Đã cập nhật`;
        setTimeout(() => { if (!isSyncing && btnSync) btnSync.innerHTML = `<span class="icon">🔄</span> Làm mới dữ liệu gốc`; }, 3000);
    });
}

// Lắng nghe tín hiệu khi Ghost Tab AI đã đăng nhập xong
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sessionRenewedSuccessfully") {
        executeFetchGrades();
    }
});

/* ============================================================
   6. INIT SỰ KIỆN GIAO DIỆN CHÍNH (SIDEBAR, MODAL, SETTINGS)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- TỰ ĐỘNG THU PHÓNG (ZOOM) TRÌNH DUYỆT VỀ MỨC 75% ---
    if (chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent((tab) => {
            if (tab && tab.id) {
                chrome.tabs.setZoom(tab.id, 0.67);
            }
        });
    }
    
    // --- NẠP DỮ LIỆU ĐIỂM BAN ĐẦU ---
    chrome.storage.local.get(['iuh_grade_data'], result => {
        if (result.iuh_grade_data) {
            globalDashboardData = result.iuh_grade_data;
            renderDashboard(globalDashboardData);
        } else {
            executeFetchGrades();
        }
    });
    if ($('btn-sync-grades')) $('btn-sync-grades').addEventListener('click', executeFetchGrades);

    // --- CHUYỂN TAB SIDEBAR (SPA) ---
    const navs = ['nav-grades', 'nav-schedule', 'nav-survey', 'nav-settings'];
    function switchActiveNav(activeId) {
        navs.forEach(id => { if ($(id)) $(id).classList.remove('active'); });
        if ($(activeId)) $(activeId).classList.add('active');
    }

    if ($('nav-grades')) {
        $('nav-grades').addEventListener('click', (e) => {
            e.preventDefault(); switchActiveNav('nav-grades');
            $('tab-content-grades').style.display = 'block';
            $('tab-content-settings').style.display = 'none';
        });
    }

    if ($('nav-settings')) {
        $('nav-settings').addEventListener('click', (e) => {
            e.preventDefault(); switchActiveNav('nav-settings');
            $('tab-content-grades').style.display = 'none';
            $('tab-content-settings').style.display = 'block';
            
            // Render màu vào setting và nạp cấu hình hiện tại
            const colors = `<option value="1">Lavender (Tím nhạt)</option><option value="2">Sage (Xanh lá nhạt)</option><option value="3">Grape (Tím đậm)</option><option value="4">Flamingo (Hồng)</option><option value="5">Banana (Vàng nhạt)</option><option value="6">Tangerine (Cam)</option><option value="7">Peacock (Xanh lơ)</option><option value="8">Graphite (Xám)</option><option value="9">Blueberry (Xanh dương)</option><option value="10">Basil (Xanh đậm)</option><option value="11">Tomato (Đỏ)</option>`;
            document.querySelectorAll('.color-select-input').forEach(el => el.innerHTML = colors);
            
            chrome.storage.sync.get(['iuhUser', 'iuhPass', 'autoFillInfo', 'autoClickLogin', 'calendarColorDirect', 'calendarColorOnline', 'calendarColorPractice', 'calendarColorPostponed', 'calendarColorExam'], (res) => {
                if ($('setting-user')) $('setting-user').value = res.iuhUser || '';
                if ($('setting-pass')) $('setting-pass').value = res.iuhPass || '';
                if ($('setting-auto-fill')) $('setting-auto-fill').checked = res.autoFillInfo !== false;
                if ($('setting-auto-login')) $('setting-auto-login').checked = res.autoClickLogin !== false;
                if ($('setting-color-direct')) $('setting-color-direct').value = res.calendarColorDirect || '9';    
                if ($('setting-color-online')) $('setting-color-online').value = res.calendarColorOnline || '7';    
                if ($('setting-color-practice')) $('setting-color-practice').value = res.calendarColorPractice || '2';
                if ($('setting-color-postponed')) $('setting-color-postponed').value = res.calendarColorPostponed || '8';
                if ($('setting-color-exam')) $('setting-color-exam').value = res.calendarColorExam || '11';
            });
        });
    }

    // --- LƯU SETTINGS ---
    if ($('btn-save-settings')) {
        $('btn-save-settings').addEventListener('click', () => {
            chrome.storage.sync.set({
                iuhUser: $('setting-user').value.trim(), iuhPass: $('setting-pass').value,
                autoFillInfo: $('setting-auto-fill').checked, autoClickLogin: $('setting-auto-login').checked,
                calendarColorDirect: $('setting-color-direct').value, calendarColorOnline: $('setting-color-online').value,
                calendarColorPractice: $('setting-color-practice').value, calendarColorPostponed: $('setting-color-postponed').value,
                calendarColorExam: $('setting-color-exam').value
            }, () => {
                $('btn-save-settings').innerText = '✅ Đã lưu cấu hình thành công!';
                setTimeout(() => { $('btn-save-settings').innerText = '💾 Lưu cấu hình hệ thống'; }, 2000);
            });
        });
    }

    // --- POPUP ĐỒNG BỘ LỊCH HỌC ---
    if ($('nav-schedule')) {
        $('nav-schedule').addEventListener('click', (e) => {
            e.preventDefault(); switchActiveNav('nav-schedule');
            $('modal-weeks-sync').style.display = 'flex';
            $('sync-weeks-input').focus();
        });
    }
    const closeModals = () => { if ($('modal-weeks-sync')) $('modal-weeks-sync').style.display = 'none'; };
    if ($('btn-close-weeks-modal')) $('btn-close-weeks-modal').addEventListener('click', closeModals);
    
    function triggerScheduleSync() {
        $('btn-submit-weeks-modal').innerText = '⏳ Đang mở Ghost Tab...';
        chrome.storage.local.set({ iuh_sync_weeks_count: parseInt($('sync-weeks-input').value) || 5, iuh_auto_sync_active: true }, () => {
            chrome.runtime.sendMessage({ action: "triggerManualScheduleSync" });
            closeModals();
            setTimeout(() => { $('btn-submit-weeks-modal').innerText = 'Cập nhật (Enter)'; }, 2000);
        });
    }
    if ($('btn-submit-weeks-modal')) $('btn-submit-weeks-modal').addEventListener('click', triggerScheduleSync);

// --- AUTO KHẢO SÁT ---
    if ($('nav-survey')) {
        // TẠO GIAO DIỆN: Khối hộp hiển thị tiến trình (Ẩn mặc định, nằm ngay dưới nút Khảo sát)
        const surveyProgressContainer = document.createElement('div');
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
        // Gắn khối hộp tiến trình vào sát ngay dưới nút nav-survey
        $('nav-survey').parentNode.insertBefore(surveyProgressContainer, $('nav-survey').nextSibling);

        $('nav-survey').addEventListener('click', (e) => {
            e.preventDefault(); switchActiveNav('nav-survey');
            if (confirm("Extension sẽ tự động chọn mức 'Bình thường' và điền form cho TẤT CẢ các phiếu khảo sát chưa làm. Bạn có muốn tiếp tục?")) {
                // Xóa trạng thái cũ đi và khởi động luồng ngầm
                chrome.storage.local.remove('iuh_survey_status', () => {
                    chrome.storage.local.set({ 'iuh_auto_survey_running': true, 'iuh_survey_current_index': 0, 'iuh_survey_urls': [] }, () => {
                        chrome.runtime.sendMessage({ action: "triggerAutoSurvey" });
                    });
                });
            }
        });

        // LẮNG NGHE STORAGE: Tự động vẽ thanh Tiến trình theo thời gian thực
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.iuh_survey_current_index || changes.iuh_survey_urls || changes.iuh_survey_status || changes.iuh_auto_survey_running)) {
                chrome.storage.local.get(['iuh_auto_survey_running', 'iuh_survey_current_index', 'iuh_survey_urls', 'iuh_survey_status'], (data) => {
                    const isRunning = data.iuh_auto_survey_running;
                    const current = data.iuh_survey_current_index || 0;
                    const urls = data.iuh_survey_urls || [];
                    const total = urls.length;
                    const status = data.iuh_survey_status;

                    if (isRunning) {
                        // Nếu chưa nạp xong số lượng -> Chỉ hiện báo đang tải
                        if (total === 0) {
                            surveyProgressContainer.style.display = 'block';
                            $('survey-progress-text').innerText = `Đang tải danh sách khảo sát...`;
                            $('survey-progress-bar').style.width = `100%`;
                            $('survey-progress-bar').style.background = `var(--warning)`;
                        } 
                        // Đã có số lượng -> Vẽ thanh tiến trình %
                        else {
                            surveyProgressContainer.style.display = 'block';
                            const percent = Math.round((current / total) * 100);
                            $('survey-progress-text').innerText = `Đang xử lý môn số ${current}/${total} (${percent}%)`;
                            $('survey-progress-bar').style.width = `${percent}%`;
                            $('survey-progress-bar').style.background = `#28a745`;
                        }
                    } else {
                        // Tắt hộp tiến trình ngay khi hoàn thành
                        surveyProgressContainer.style.display = 'none';
                        
                        // Đón tín hiệu Popup Thông báo
                        if (status === 'NO_SURVEYS') {
                            alert("🎉 Tuyệt vời! Bạn không còn phiếu khảo sát học phần nào cần làm.");
                            chrome.storage.local.remove('iuh_survey_status');
                        } else if (status === 'DONE') {
                            alert("✅ Hoàn tất! Đã tự động điền xong toàn bộ phiếu khảo sát.");
                            chrome.storage.local.remove('iuh_survey_status');
                        }
                    }
                });
            }
        });
    }

    // --- UI PHỤ (Toggles) ---
    if ($('btn-toggle-reg')) {
        $('btn-toggle-reg').addEventListener('click', () => {
            $('reg-panel').classList.toggle('show');
            $('btn-toggle-reg').innerText = $('reg-panel').classList.contains('show') ? '✕' : 'i';
        });
    }
    if ($('btn-toggle-password')) {
        $('btn-toggle-password').addEventListener('click', () => {
            const t = $('setting-pass');
            if (t.type === 'password') { t.type = 'text'; $('btn-toggle-password').style.color = '#fff'; } 
            else { t.type = 'password'; $('btn-toggle-password').style.color = 'var(--text-muted)'; }
        });
    }
});