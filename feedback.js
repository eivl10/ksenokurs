// Вставь сюда URL, который выдаст Google после развертывания скрипта
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZieSxdeflKxptF3yEBl8ipv0qM_vOV-V0v3K4i6uhH821NzoO__lc9d4S0st7Jh0-/exec'; 

let isFeedbackMode = false;
let currentTempPin = null;
let allPins = []; // Stores all fetched rows

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getSavedName() {
    return localStorage.getItem('feedback_author_name') || '';
}

function saveName(name) {
    localStorage.setItem('feedback_author_name', name);
}

function initFeedbackUI() {
    const btn = document.createElement('button');
    btn.id = 'feedback-toggle-btn';
    btn.textContent = '💬 Оставить фидбек';
    document.body.appendChild(btn);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        isFeedbackMode = !isFeedbackMode;
        if (isFeedbackMode) {
            btn.textContent = '❌ Отменить';
            btn.classList.add('active');
            document.body.classList.add('feedback-active');
        } else {
            btn.textContent = '💬 Оставить фидбек';
            btn.classList.remove('active');
            document.body.classList.remove('feedback-active');
            closePopup();
        }
    });

    const popup = document.createElement('div');
    popup.id = 'feedback-popup';
    popup.innerHTML = `
        <div id="feedback-write-mode">
            <h4>
                <span>Новый комментарий</span>
                <span class="feedback-close-icon" title="Закрыть">&times;</span>
            </h4>
            <input type="text" id="feedback-name-input" placeholder="Твое имя (сохранится)">
            <textarea id="feedback-textarea" placeholder="Напиши комментарий..."></textarea>
            <div class="feedback-actions-row">
                <button id="feedback-save-btn" class="feedback-btn-primary">Отправить</button>
            </div>
        </div>
        <div id="feedback-read-mode" style="display: none;">
            <h4>
                <span>Обсуждение</span>
                <div class="feedback-header-actions">
                    <button id="feedback-resolve-btn" class="feedback-resolve-btn" title="Пометить как решенное">
                        ✔️ Решить
                    </button>
                    <span class="feedback-close-icon" title="Закрыть окно">&times;</span>
                </div>
            </h4>
            <div id="feedback-thread-list"></div>
            
            <input type="text" id="feedback-reply-name-input" placeholder="Твое имя">
            <textarea id="feedback-reply-textarea" placeholder="Ответить..."></textarea>
            <div class="feedback-actions-row">
                <button id="feedback-reply-btn" class="feedback-btn-primary">Ответить</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    // Close buttons (using the (x) icon)
    document.querySelectorAll('.feedback-close-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopup();
        });
    });
    
    // Resolve thread button
    document.getElementById('feedback-resolve-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const threadId = popup.dataset.threadId;
        const btnResolve = document.getElementById('feedback-resolve-btn');
        btnResolve.textContent = '⏳...';
        btnResolve.disabled = true;

        try {
            await sendToGoogle({ action: 'resolve', id: threadId });
            
            // Mark as resolved locally
            allPins.forEach(p => {
                if (p.id === threadId || p.parentId === threadId) {
                    p.status = 'Resolved';
                }
            });
            
            // Remove the pin element
            const pinEl = document.querySelector(`.feedback-pin[data-id="${threadId}"]`);
            if (pinEl) pinEl.remove();
            
            closePopup();
        } catch (err) {
            alert('Ошибка: ' + err);
        } finally {
            btnResolve.textContent = '✔️ Решить';
            btnResolve.disabled = false;
        }
    });
    
    // Save new pin
    document.getElementById('feedback-save-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = document.getElementById('feedback-textarea').value.trim();
        const name = document.getElementById('feedback-name-input').value.trim();
        
        if (!text || !name) {
            alert('Пожалуйста, введи имя и текст комментария!');
            return;
        }
        
        saveName(name);
        const btnSave = document.getElementById('feedback-save-btn');
        btnSave.textContent = 'Отправка...';
        btnSave.disabled = true;

        const x = parseFloat(popup.dataset.x);
        const y = parseFloat(popup.dataset.y);
        const page = window.location.pathname;
        const newId = generateId();

        try {
            await sendToGoogle({ page, x, y, text, id: newId, parentId: '', name });
            const newPin = { x, y, text, date: new Date().toLocaleString(), page, id: newId, parentId: '', name, status: 'Open' };
            allPins.push(newPin);
            renderPin(newPin);
            closePopup();
        } catch (err) {
            alert('Ошибка при отправке: ' + err);
        } finally {
            btnSave.textContent = 'Отправить';
            btnSave.disabled = false;
        }
    });

    // Save reply
    document.getElementById('feedback-reply-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = document.getElementById('feedback-reply-textarea').value.trim();
        const name = document.getElementById('feedback-reply-name-input').value.trim();
        
        if (!text || !name) {
            alert('Пожалуйста, введи имя и текст ответа!');
            return;
        }
        
        saveName(name);
        const btnReply = document.getElementById('feedback-reply-btn');
        btnReply.textContent = 'Отправка...';
        btnReply.disabled = true;

        const parentId = popup.dataset.threadId;
        const page = window.location.pathname;
        const newId = generateId();

        try {
            await sendToGoogle({ page, x: '', y: '', text, id: newId, parentId: parentId, name });
            const newReply = { x: '', y: '', text, date: new Date().toLocaleString(), page, id: newId, parentId, name, status: 'Open' };
            allPins.push(newReply);
            
            // Re-render thread list
            renderThread(parentId);
            updatePinCount(parentId);
            
            document.getElementById('feedback-reply-textarea').value = '';
        } catch (err) {
            alert('Ошибка при отправке: ' + err);
        } finally {
            btnReply.textContent = 'Ответить';
            btnReply.disabled = false;
        }
    });

    // Document Click Handler
    document.addEventListener('click', (e) => {
        if (!isFeedbackMode) return;
        if (e.target.closest('#feedback-popup') || e.target.closest('#feedback-toggle-btn') || e.target.closest('.feedback-pin')) {
            return;
        }
        e.preventDefault();
        openWritePopup(e.pageX, e.pageY);
    });

    loadPins();
}

async function sendToGoogle(payload) {
    if (GOOGLE_SCRIPT_URL.includes('PLACEHOLDER')) throw new Error("Не указан URL скрипта");
    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

function openWritePopup(x, y) {
    if (currentTempPin) currentTempPin.remove();

    currentTempPin = document.createElement('div');
    currentTempPin.className = 'feedback-pin';
    currentTempPin.style.left = x + 'px';
    currentTempPin.style.top = y + 'px';
    currentTempPin.textContent = '+';
    document.body.appendChild(currentTempPin);

    const popup = document.getElementById('feedback-popup');
    popup.style.display = 'block';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    
    popup.dataset.x = x;
    popup.dataset.y = y;

    document.getElementById('feedback-write-mode').style.display = 'block';
    document.getElementById('feedback-read-mode').style.display = 'none';
    
    document.getElementById('feedback-name-input').value = getSavedName();
    const ta = document.getElementById('feedback-textarea');
    ta.value = '';
    ta.focus();
}

function getThreadPins(threadId) {
    return allPins.filter(p => (p.id === threadId || p.parentId === threadId) && p.status !== 'Resolved');
}

function renderThread(threadId) {
    const threadPins = getThreadPins(threadId);
    
    const list = document.getElementById('feedback-thread-list');
    list.innerHTML = '';
    
    threadPins.forEach(p => {
        const msg = document.createElement('div');
        msg.className = 'feedback-message';
        msg.innerHTML = `
            <div class="feedback-message-header">
                <span class="feedback-author">${p.name || 'Гость'}</span>
                <span class="feedback-date">${formatDate(p.date)}</span>
            </div>
            <p class="feedback-text">${p.text}</p>
        `;
        list.appendChild(msg);
    });
    
    list.scrollTop = list.scrollHeight;
}

function openReadPopup(threadId, x, y) {
    const popup = document.getElementById('feedback-popup');
    popup.style.display = 'block';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    popup.dataset.threadId = threadId;

    document.getElementById('feedback-write-mode').style.display = 'none';
    document.getElementById('feedback-read-mode').style.display = 'block';
    
    document.getElementById('feedback-reply-name-input').value = getSavedName();
    document.getElementById('feedback-reply-textarea').value = '';
    
    renderThread(threadId);
}

function closePopup() {
    document.getElementById('feedback-popup').style.display = 'none';
    if (currentTempPin) {
        currentTempPin.remove();
        currentTempPin = null;
    }
}

function getPrimaryPins() {
    return allPins.filter(p => !p.parentId && p.status !== 'Resolved'); 
}

function updatePinCount(threadId) {
    const pinEl = document.querySelector(`.feedback-pin[data-id="${threadId}"]`);
    if (pinEl) {
        const threadPins = getThreadPins(threadId);
        pinEl.textContent = threadPins.length;
    }
}

function renderPin(pinData) {
    if (pinData.parentId || pinData.status === 'Resolved') return;
    
    const pin = document.createElement('div');
    pin.className = 'feedback-pin';
    pin.dataset.id = pinData.id;
    pin.style.left = pinData.x + 'px';
    pin.style.top = pinData.y + 'px';
    
    pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openReadPopup(pinData.id, pinData.x, pinData.y);
    });

    document.body.appendChild(pin);
    updatePinCount(pinData.id); // Set initial count
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
        // Return time if today, else date
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
            return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch(e) {
        return dateStr;
    }
}

async function loadPins() {
    if (GOOGLE_SCRIPT_URL.includes('PLACEHOLDER')) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?page=" + encodeURIComponent(window.location.pathname));
        const data = await response.json();
        allPins = data;
        
        getPrimaryPins().forEach(pin => {
            renderPin(pin);
        });
    } catch(e) {
        console.error("Could not load feedback pins:", e);
    }
}

document.addEventListener('DOMContentLoaded', initFeedbackUI);
