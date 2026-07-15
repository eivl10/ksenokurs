// Вставь сюда URL, который выдаст Google после развертывания скрипта
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZieSxdeflKxptF3yEBl8ipv0qM_vOV-V0v3K4i6uhH821NzoO__lc9d4S0st7Jh0-/exec'; 

let isFeedbackMode = false;
let currentTempPin = null;
let allPins = [];

// Initialize UI
function initFeedbackUI() {
    // 1. Add Toggle Button
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

    // 2. Add Popup Container
    const popup = document.createElement('div');
    popup.id = 'feedback-popup';
    popup.innerHTML = `
        <div id="feedback-write-mode">
            <h4>Новый комментарий</h4>
            <textarea id="feedback-textarea" placeholder="Напиши свои правки сюда..."></textarea>
            <div>
                <button id="feedback-save-btn">Отправить</button>
                <button id="feedback-cancel-btn">Отмена</button>
            </div>
        </div>
        <div id="feedback-read-mode" style="display: none;">
            <h4>Комментарий</h4>
            <div class="feedback-date" id="feedback-date-text"></div>
            <div id="feedback-read-text"></div>
            <button id="feedback-close-btn">Закрыть</button>
        </div>
    `;
    document.body.appendChild(popup);

    // Event listeners for popup buttons
    document.getElementById('feedback-cancel-btn').addEventListener('click', closePopup);
    document.getElementById('feedback-close-btn').addEventListener('click', closePopup);
    
    document.getElementById('feedback-save-btn').addEventListener('click', async () => {
        const text = document.getElementById('feedback-textarea').value.trim();
        if (!text) return;
        
        const btnSave = document.getElementById('feedback-save-btn');
        btnSave.textContent = 'Отправка...';
        btnSave.disabled = true;

        const x = parseFloat(popup.dataset.x);
        const y = parseFloat(popup.dataset.y);
        const page = window.location.pathname;

        try {
            if (GOOGLE_SCRIPT_URL === 'PLACEHOLDER_URL') {
                alert('Скрипт Google Таблиц еще не подключен! Замени PLACEHOLDER_URL в feedback.js');
                closePopup();
                return;
            }

            // POST to Google Script
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Needs no-cors for simple Google App Script forms
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: page, x: x, y: y, text: text })
            });

            // Assuming success due to no-cors
            const newPin = { x, y, text, date: new Date().toLocaleString(), page };
            allPins.push(newPin);
            renderPin(newPin, allPins.length);
            closePopup();
        } catch (e) {
            alert('Ошибка при отправке: ' + e);
        } finally {
            btnSave.textContent = 'Отправить';
            btnSave.disabled = false;
        }
    });

    // 3. Document Click Handler for adding pins
    document.addEventListener('click', (e) => {
        if (!isFeedbackMode) return;
        
        // Prevent clicking if we clicked inside our UI
        if (e.target.closest('#feedback-popup') || e.target.closest('#feedback-toggle-btn') || e.target.closest('.feedback-pin')) {
            return;
        }

        e.preventDefault();
        
        // Calculate relative coordinates (percentage based on document dimensions is more robust for responsive)
        // But for simplicity, we'll use absolute page coordinates
        const x = e.pageX;
        const y = e.pageY;
        
        openWritePopup(x, y);
    });

    // 4. Load existing pins
    loadPins();
}

function openWritePopup(x, y) {
    if (currentTempPin) {
        currentTempPin.remove();
    }

    // Create temporary pin
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
    
    const ta = document.getElementById('feedback-textarea');
    ta.value = '';
    ta.focus();
}

function openReadPopup(pinData, element) {
    const popup = document.getElementById('feedback-popup');
    popup.style.display = 'block';
    popup.style.left = pinData.x + 'px';
    popup.style.top = pinData.y + 'px';

    document.getElementById('feedback-write-mode').style.display = 'none';
    document.getElementById('feedback-read-mode').style.display = 'block';
    
    document.getElementById('feedback-read-text').textContent = pinData.text;
    document.getElementById('feedback-date-text').textContent = pinData.date || '';
}

function closePopup() {
    document.getElementById('feedback-popup').style.display = 'none';
    if (currentTempPin) {
        currentTempPin.remove();
        currentTempPin = null;
    }
}

function renderPin(pinData, index) {
    const pin = document.createElement('div');
    pin.className = 'feedback-pin';
    pin.style.left = pinData.x + 'px';
    pin.style.top = pinData.y + 'px';
    pin.textContent = index;
    
    pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openReadPopup(pinData, pin);
    });

    document.body.appendChild(pin);
}

async function loadPins() {
    if (GOOGLE_SCRIPT_URL === 'PLACEHOLDER_URL') return;
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?page=" + encodeURIComponent(window.location.pathname));
        const data = await response.json();
        allPins = data;
        
        // Render only pins for this page
        allPins.forEach((pin, i) => {
            renderPin(pin, i + 1);
        });
    } catch(e) {
        console.error("Could not load feedback pins:", e);
    }
}

// Start
document.addEventListener('DOMContentLoaded', initFeedbackUI);
