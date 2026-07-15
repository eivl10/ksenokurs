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
            <h4>Новый комментарий <span class="feedback-close-icon">&times;</span></h4>
            <input type="text" id="feedback-name-input" placeholder="Твое имя (сохранится)">
            <textarea id="feedback-textarea" placeholder="Напиши свои правки сюда..."></textarea>
            <div>
                <button id="feedback-save-btn" class="feedback-btn-primary">Отправить</button>
            </div>
        </div>
        <div id="feedback-read-mode" style="display: none;">
            <h4>Ветка комментариев <span class="feedback-close-icon">&times;</span></h4>
            <div id="feedback-thread-list"></div>
            
            <input type="text" id="feedback-reply-name-input" placeholder="Твое имя">
            <textarea id="feedback-reply-textarea" placeholder="Ответить..."></textarea>
            <div>
                <button id="feedback-reply-btn" class="feedback-btn-primary">Ответить</button>
                <button id="feedback-close-btn" class="feedback-btn-secondary">Закрыть окно</button>
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
    
    // Bottom close button
    const closeBtn = document.getElementById('feedback-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopup();
        });
    }
    
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
            const newPin = { x, y, text, date: new Date().toLocaleString(), page, id: newId, parentId: '', name };
            allPins.push(newPin);
            renderPin(newPin, getPrimaryPins().length);
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
            // we send empty x and y for replies
            await sendToGoogle({ page, x: '', y: '', text, id: newId, parentId: parentId, name });
            const newReply = { x: '', y: '', text, date: new Date().toLocaleString(), page, id: newId, parentId, name };
            allPins.push(newReply);
            
            // Re-render thread list
            renderThread(parentId);
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

function renderThread(threadId) {
    const threadPins = allPins.filter(p => p.id === threadId || p.parentId === threadId);
    // Sort by date or just keep order (they usually arrive in order)
    
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
    
    // Scroll to bottom
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
    return allPins.filter(p => !p.parentId); // Only pins that don't have a parent
}

function renderPin(pinData, index) {
    if (pinData.parentId) return; // don't render replies as separate pins
    
    const pin = document.createElement('div');
    pin.className = 'feedback-pin';
    pin.style.left = pinData.x + 'px';
    pin.style.top = pinData.y + 'px';
    pin.textContent = index;
    
    pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openReadPopup(pinData.id, pinData.x, pinData.y);
    });

    document.body.appendChild(pin);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
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
        
        getPrimaryPins().forEach((pin, i) => {
            renderPin(pin, i + 1);
        });
    } catch(e) {
        console.error("Could not load feedback pins:", e);
    }
}

document.addEventListener('DOMContentLoaded', initFeedbackUI);
