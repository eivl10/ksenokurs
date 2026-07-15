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

    // Close buttons
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
            
            allPins.forEach(p => {
                if (p.id === threadId || p.parentId === threadId) {
                    p.status = 'Resolved';
                }
            });
            
            const pinEl = document.querySelector(`.feedback-pin[data-id="${threadId}"]`);
            if (pinEl) pinEl.remove();
            
            document.querySelectorAll(`.feedback-text-highlight[data-thread-id="${threadId}"]`).forEach(el => {
                // Remove highlight by replacing span with its text
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            });
            
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

        const isHighlight = popup.dataset.isHighlight === 'true';
        let x = popup.dataset.x;
        let y = popup.dataset.y;
        
        if (isHighlight) {
            x = 'text';
            y = popup.dataset.selectedText;
        }

        const page = window.location.pathname;
        const newId = generateId();

        try {
            await sendToGoogle({ page, x, y, text, id: newId, parentId: '', name });
            const newPin = { x, y, text, date: new Date().toISOString(), page, id: newId, parentId: '', name, status: 'Open' };
            allPins.push(newPin);
            
            // Mark as read immediately
            markAsRead(newId);
            
            if (isHighlight) {
                highlightTextNodes(y, newId);
            } else {
                renderPin(newPin);
            }
            
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
        const dateIso = new Date().toISOString();

        try {
            await sendToGoogle({ page, x: '', y: '', text, id: newId, parentId: parentId, name });
            const newReply = { x: '', y: '', text, date: dateIso, page, id: newId, parentId, name, status: 'Open' };
            allPins.push(newReply);
            
            markAsRead(parentId);
            
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

    // Handle Text Selection
    document.addEventListener('mouseup', (e) => {
        if (!isFeedbackMode) return;
        if (e.target.closest('#feedback-popup') || e.target.closest('#feedback-toggle-btn')) return;
        
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            e.preventDefault();
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            openWritePopup(rect.left + window.scrollX + (rect.width/2), rect.bottom + window.scrollY, true, selectedText);
            selection.removeAllRanges();
        }
    });

    // Document Click Handler (for standard pins)
    document.addEventListener('click', (e) => {
        if (!isFeedbackMode) return;
        if (e.target.closest('#feedback-popup') || e.target.closest('#feedback-toggle-btn') || e.target.closest('.feedback-pin') || e.target.closest('.feedback-text-highlight')) {
            return;
        }
        
        // If selection exists, let mouseup handle it
        if (window.getSelection().toString().trim() !== '') return;
        
        e.preventDefault();
        openWritePopup(e.pageX, e.pageY, false);
    });

    loadPins();
}

// Unread Logic
function getThreadLastDate(threadId) {
    const threadPins = getThreadPins(threadId);
    if (threadPins.length === 0) return 0;
    return Math.max(...threadPins.map(p => {
        const d = new Date(p.date);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }));
}

function checkUnread(threadId, element) {
    const lastDate = getThreadLastDate(threadId);
    const readDate = parseInt(localStorage.getItem('feedback_read_' + threadId) || '0');
    if (lastDate > readDate) {
        element.classList.add('has-unread');
    } else {
        element.classList.remove('has-unread');
    }
}

function markAsRead(threadId) {
    localStorage.setItem('feedback_read_' + threadId, Date.now());
    const pinEl = document.querySelector(`.feedback-pin[data-id="${threadId}"]`);
    if (pinEl) pinEl.classList.remove('has-unread');
    
    document.querySelectorAll(`.feedback-text-highlight[data-thread-id="${threadId}"]`).forEach(el => {
        el.classList.remove('has-unread');
    });
}

function highlightTextNodes(searchText, threadId) {
    if (!searchText) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.parentElement && node.parentElement.closest('#feedback-popup, #feedback-toggle-btn')) continue;
        if (node.parentElement && node.parentElement.classList.contains('feedback-text-highlight')) continue;
        
        const index = node.nodeValue.indexOf(searchText);
        if (index >= 0) {
            const span = document.createElement('span');
            span.className = 'feedback-text-highlight';
            span.dataset.threadId = threadId;
            span.textContent = searchText;
            
            const afterText = node.nodeValue.substring(index + searchText.length);
            node.nodeValue = node.nodeValue.substring(0, index);
            
            node.parentNode.insertBefore(span, node.nextSibling);
            if (afterText) {
                node.parentNode.insertBefore(document.createTextNode(afterText), span.nextSibling);
            }
            
            checkUnread(threadId, span);
            
            span.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = span.getBoundingClientRect();
                openReadPopup(threadId, rect.left + window.scrollX + (rect.width/2), rect.bottom + window.scrollY);
            });
            break; // Highlight first match
        }
    }
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

function openWritePopup(x, y, isHighlight = false, selectedText = '') {
    if (currentTempPin) currentTempPin.remove();

    if (!isHighlight) {
        currentTempPin = document.createElement('div');
        currentTempPin.className = 'feedback-pin';
        currentTempPin.style.left = x + 'px';
        currentTempPin.style.top = y + 'px';
        currentTempPin.textContent = '+';
        document.body.appendChild(currentTempPin);
    }

    const popup = document.getElementById('feedback-popup');
    popup.style.display = 'block';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    
    popup.dataset.x = x;
    popup.dataset.y = y;
    popup.dataset.isHighlight = isHighlight;
    popup.dataset.selectedText = selectedText;

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
    
    // Sort by date correctly
    threadPins.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
    markAsRead(threadId);
    
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
        checkUnread(threadId, pinEl);
    }
    document.querySelectorAll(`.feedback-text-highlight[data-thread-id="${threadId}"]`).forEach(el => {
        checkUnread(threadId, el);
    });
}

function renderPin(pinData) {
    if (pinData.parentId || pinData.status === 'Resolved') return;
    
    if (pinData.x === 'text') {
        highlightTextNodes(pinData.y, pinData.id);
        return;
    }
    
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
    updatePinCount(pinData.id);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
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
