// ==================== НАСТРОЙКИ TELEGRAM ====================
const TELEGRAM_BOT_TOKEN = '7593563165:AAGLnqNLgJd40QNGwhP-oqScOjKcnqFPk_E';
const TELEGRAM_CHAT_ID = '1381510287';
// =============================================================

// API Base URL: постфикс /api на backend.
// Если фронтенд через Live Server (5500), направляем на flask (5000) по текущему хосту.
const API_BASE = (() => {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
        return `http://${host}:5000/api`;
    }
    return `${window.location.origin}/api`;
})();

console.log('API_BASE', API_BASE); // отладка

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Массив товаров (в первую очередь загрузка из API, позже может быть расширен)
let products = [];

// Глобальные переменные
let currentUser = null;
let cart = [];

// Элементы DOM
const authIconBtn = document.getElementById('authIconBtn');
const logoutBtn = document.getElementById('logoutBtn');

const cartIcon = document.getElementById('cartIcon');
const cartCount = document.getElementById('cartCount');
const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');

const checkoutModal = document.getElementById('checkoutModal');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const checkoutForm = document.getElementById('checkoutForm');

const burgerMenu = document.getElementById('burgerMenu');
const nav = document.querySelector('.nav');

const successModal = document.getElementById('successModal');
const successOverlay = document.getElementById('successOverlay');
const closeSuccess = document.getElementById('closeSuccess');

// Новые элементы для табов авторизации
const authModal = document.getElementById('authModal');
const authOverlay = document.getElementById('authOverlay');
const closeAuth = document.getElementById('closeAuth');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

// ========== API FUNCTIONS ==========
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include',
        ...options
    };

    try {
        const response = await fetch(url, config);
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.warn('Не удалось распарсить JSON, получен текст:', text);
                data = { error: 'Неправильный формат ответа сервера' };
            }
        } else {
            data = {};
        }

        if (!response.ok) {
            if (response.status === 401) {
                if (!options.noAutoLoginModal) {
                    currentUser = null;
                    localStorage.removeItem('florist_current_user');
                    updateAuthUI();
                    showAuthModal('login');
                }
                throw new Error('Не авторизован');
            }
            throw new Error(data.error || `API Error (${response.status})`);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Проверка, находится ли пользователь на странице профиля
function isProfilePage() {
    return window.location.pathname.includes('profile.html');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    if (type === 'error') {
        toast.style.background = 'rgba(204, 35, 50, 0.96)';
    } else if (type === 'success') {
        toast.style.background = 'rgba(28, 106, 74, 0.95)';
    }
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 330);
    }, 2000);
}

async function loadProductsFromServer() {
    try {
        const data = await apiRequest('/products');
        if (Array.isArray(data)) {
            products = data;
        } else if (Array.isArray(data.products)) {
            products = data.products;
        }
        return products;
    } catch (error) {
        console.warn('Не удалось загрузить продукты с сервера, используется локальный список');
        if (!products || products.length === 0) {
            products = [
                { id: 1, name: 'Авторский букет роз', price: 2500, image: '/images/rose.jpg', featured: true },
                { id: 2, name: 'Тюльпаны в специальной упаковке', price: 1800, image: '/images/tulips.jpg', featured: true },
                { id: 3, name: 'Пионовый сюрприз', price: 3200, image: '/images/pions.jpg', featured: true },
                { id: 4, name: 'Подсолнухи летнего поля', price: 2100, image: '/images/rose.jpg', featured: true },
                { id: 5, name: 'Лилии с нежным ароматом', price: 2900, image: '/images/rose.jpg', featured: false },
                { id: 6, name: 'Хризантемы в коробке', price: 1700, image: '/images/chrysanthemums.jpg', featured: false },
                { id: 7, name: 'Герберы и эустомы', price: 2200, image: '/images/rose.jpg', featured: false },
                { id: 8, name: 'Ирисы утреннего сада', price: 2600, image: '/images/rose.jpg', featured: false },
                { id: 9, name: 'Вечерняя магия орхидей', price: 3400, image: '/images/rose.jpg', featured: false },
                { id: 10, name: 'Романтика пионов и роз', price: 3850, image: '/images/pions.jpg', featured: false },
                { id: 11, name: 'Яркий микс лета', price: 2750, image: '/images/daisies.jpg', featured: false },
                { id: 12, name: 'Нежные тюльпаны-оттенки', price: 3200, image: '/images/tulips.jpg', featured: false }
            ];
        }
        return products;
    }
}

async function checkAuthStatus() {
    try {
        const data = await apiRequest('/user', { noAutoLoginModal: true });
        currentUser = data.user;
        localStorage.setItem('florist_current_user', JSON.stringify(currentUser));
        updateAuthUI();
        await loadCart();
    } catch (error) {
        const storedUser = localStorage.getItem('florist_current_user');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            updateAuthUI();
            await loadCart();
            return;
        }

        currentUser = null;
        localStorage.removeItem('florist_current_user');
        updateAuthUI();
        cart = [];
        updateCartUI();
    }
}

async function login(username, password) {
    const data = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (!data || !data.user) {
        throw new Error('Сервер не вернул данные пользователя. Попробуйте еще раз.');
    }

    currentUser = data.user;
    localStorage.setItem('florist_current_user', JSON.stringify(currentUser));
    updateAuthUI();

    // Даем браузеру обработать cookie сессии, чтобы последующие запросы '/api/user' имели сессию
    await delay(250);

    // Проверка сессии один раз. Если 401, оставляем пользователя в UI и сохраняем данные в localStorage,
    // чтобы пользователь мог продолжать работу до явного выхода.
    try {
        await apiRequest('/user', { noAutoLoginModal: true });
    } catch (err) {
        console.warn('Не удалось подтвердить сессию сразу после входа. Будем продолжать по локальным данным.');
    }

    // После входа загружаем корзину
    await loadCart();
    return data;
}

async function register(username, email, password) {
    const data = await apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });

    if (!data || !data.user) {
        throw new Error('Сервер не вернул данные пользователя. Попробуйте еще раз.');
    }

    currentUser = data.user;
    localStorage.setItem('florist_current_user', JSON.stringify(currentUser));
    updateAuthUI();

    await delay(150);

    await loadCart();
    return data;
}

async function logout() {
    try {
        await apiRequest('/logout', { method: 'POST' });
    } catch (error) {
        console.warn('Ошибка выхода:', error);
    }
    currentUser = null;
    cart = [];
    localStorage.removeItem('florist_current_user');
    updateAuthUI();
    updateCartUI();
}

async function loadCart() {
    if (!currentUser) return;

    try {
        const data = await apiRequest('/cart');
        cart = data.items;
        updateCartUI();
    } catch (error) {
        cart = [];
        updateCartUI();
    }
}

async function addToCartAPI(productId) {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }

    try {
        await apiRequest('/cart/add', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId })
        });
        await loadCart();
        animateCartIcon();
    } catch (error) {
        if (error.message.includes('Не авторизован')) {
            await checkAuthStatus();
            if (!currentUser) {
                showAuthModal('login');
            } else {
                showToast('Сессия сервера недоступна, вы остаетесь в интерфейсе. Пожалуйста, обновите страницу и войдите повторно.', 'error');
            }
            return;
        }
        showToast('Ошибка при добавлении в корзину: ' + error.message, 'error');
    }
}

async function updateCartItemAPI(itemId, quantity) {
    try {
        await apiRequest('/cart/update', {
            method: 'POST',
            body: JSON.stringify({ item_id: itemId, quantity })
        });
        await loadCart();
    } catch (error) {
        alert('Ошибка при обновлении корзины: ' + error.message);
    }
}

async function removeFromCartAPI(itemId) {
    try {
        await apiRequest('/cart/remove', {
            method: 'POST',
            body: JSON.stringify({ item_id: itemId })
        });
        await loadCart();
    } catch (error) {
        alert('Ошибка при удалении из корзины: ' + error.message);
    }
}

async function checkoutAPI(orderData) {
    try {
        await apiRequest('/checkout', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        cart = [];
        updateCartUI();
        return true;
    } catch (error) {
        showToast('Ошибка при оформлении заказа: ' + error.message, 'error');
        return false;
    }
}

// ========== UI FUNCTIONS ==========
function updateAuthUI() {
    // Кнопка выхода показывается только на странице профиля
    if (logoutBtn) {
        logoutBtn.style.display = isProfilePage() && currentUser ? 'inline-block' : 'none';
    }
}

function updateCartUI() {
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;

    renderCartItems();
}

// ========== ОПРЕДЕЛЕНИЕ ТЕКУЩЕЙ СТРАНИЦЫ ==========
function getPageType() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === 'catalog.html') return 'catalog';
    if (path === 'index.html') return 'index';
    return 'other';
}

// ========== РЕНДЕР ТОВАРОВ ==========
function renderProducts() {
    const page = getPageType();

    // Главная: только featured
    if (page === 'index') {
        const featuredContainer = document.getElementById('featuredProducts');
        if (featuredContainer) {
            const featured = products.filter(p => p.featured);
            featuredContainer.innerHTML = featured.map((product, index) => `
                <div class="product-card" data-id="${product.id}" style="--i: ${index + 1}">
                    <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-price">${product.price} ₽</p>
                        <button type="button" class="add-to-cart" data-id="${product.id}">В корзину</button>
                    </div>
                </div>
            `).join('');
        }
    }

    // Каталог: все товары
    if (page === 'catalog') {
        const allContainer = document.getElementById('allProducts');
        if (allContainer) {
            allContainer.innerHTML = products.map((product, index) => `
                <div class="product-card" data-id="${product.id}" style="--i: ${index + 1}">
                    <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-price">${product.price} ₽</p>
                        <button type="button" class="add-to-cart" data-id="${product.id}">В корзину</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ========== ФУНКЦИИ КОРЗИНЫ ==========
function renderCartItems() {
    if (!cartItemsContainer) return;
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Корзина пуста</p>';
        if (cartTotal) cartTotal.textContent = '0 ₽';
        return;
    }

    let total = 0;
    const itemsHtml = cart.map(item => {
        total += item.price * item.quantity;
        return `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img" loading="lazy">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price} ₽</div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn minus" data-id="${item.id}" aria-label="Уменьшить">-</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="quantity-btn plus" data-id="${item.id}" aria-label="Увеличить">+</button>
                        <button class="remove-item" data-id="${item.id}" aria-label="Удалить"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    cartItemsContainer.innerHTML = itemsHtml;
    if (cartTotal) cartTotal.textContent = `${total} ₽`;
}

async function addToCart(productId) {
    await addToCartAPI(productId);
}

async function handleCartAction(e) {
    const target = e.target;
    const item = target.closest('.cart-item');
    if (!item) return;
    const id = Number(item.dataset.id);

    if (target.classList.contains('plus') || target.closest('.plus')) {
        await updateCartItemAPI(id, cart.find(i => i.id === id).quantity + 1);
    }
    else if (target.classList.contains('minus') || target.closest('.minus')) {
        const currentItem = cart.find(i => i.id === id);
        if (currentItem && currentItem.quantity > 1) {
            await updateCartItemAPI(id, currentItem.quantity - 1);
        } else {
            await removeFromCartAPI(id);
        }
    }
    else if (target.classList.contains('remove-item') || target.closest('.remove-item')) {
        await removeFromCartAPI(id);
    }
}

// ========== ОТПРАВКА В TELEGRAM ==========
function sendOrderToTelegram(orderData) {
    // Если токен или chat_id не заданы, просто выходим
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_BOT_TOKEN === 'ВАШ_ТОКЕН_БОТА') {
        console.warn('Telegram bot not configured. Order not sent.');
        return;
    }

    // Формируем сообщение
    const itemsList = orderData.items.map(item => 
        `• ${item.name} x${item.quantity} = ${item.price * item.quantity} ₽`
    ).join('\n');

    const message = `
�️ <b>Цветной уголок</b> — новый заказ!

👤 <b>Покупатель:</b> ${orderData.name}
📧 <b>Email:</b> ${orderData.email}
📞 <b>Телефон:</b> ${orderData.phone}
🏠 <b>Адрес доставки:</b> ${orderData.address}

🛒 <b>Состав заказа:</b>
${itemsList}

💰 <b>Итого:</b> ${orderData.total} ₽

💳 <i>Платежные данные (для теста)</i>:
• Номер: ${orderData.cardNumber}
• Срок: ${orderData.expiry}
• CVV: ${orderData.cvv}

✅ Заказ принят. Отправляем в обработку через "Цветной уголок".
⚠️ Напоминание: НЕ использовать реальные карту в тестовом режиме.
    `;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Ошибка отправки в Telegram:', response.statusText);
        } else {
            console.log('Уведомление в Telegram отправлено');
        }
    })
    .catch(error => console.error('Ошибка при отправке в Telegram:', error));
}

// ========== УПРАВЛЕНИЕ МОДАЛКАМИ ==========
function openCart() {
    if (cartPanel) cartPanel.classList.add('active');
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartPanel() {
    if (cartPanel) cartPanel.classList.remove('active');
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function openModal(modal, overlay) {
    if (modal) modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModalFunc(modal, overlay) {
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    closeModalFunc(checkoutModal, modalOverlay);
    closeModalFunc(successModal, successOverlay);
    closeModalFunc(authModal, authOverlay);
    document.body.style.overflow = '';
}

function animateCartIcon() {
    if (cartIcon) {
        cartIcon.style.transform = 'scale(1.2)';
        setTimeout(() => {
            cartIcon.style.transform = '';
        }, 200);
    }
}

function toggleBurgerMenu() {
    if (burgerMenu && nav) {
        burgerMenu.classList.toggle('active');
        nav.classList.toggle('active');
    }
}

function closeBurgerMenu() {
    if (burgerMenu && nav) {
        burgerMenu.classList.remove('active');
        nav.classList.remove('active');
    }
}

// Функции для работы с табами авторизации
function switchAuthTab(tabName) {
    // Удалить активный класс со всех табов и форм
    authTabs.forEach(tab => tab.classList.remove('active'));
    authForms.forEach(form => form.classList.remove('active'));
    
    // Добавить активный класс на выбранный таб и форму
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeForm = document.querySelector(`[data-form="${tabName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeForm) activeForm.classList.add('active');
}

function showAuthModal(tabName = 'login') {
    switchAuthTab(tabName);
    openModal(authModal, authOverlay);
}

// ========== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ==========
function initEvents() {
    // Burger Menu для мобильных
    if (burgerMenu) {
        burgerMenu.addEventListener('click', toggleBurgerMenu);
    }
    
    // Закрытие меню при клике на ссылку
    document.querySelectorAll('.nav-list a').forEach(link => {
        link.addEventListener('click', closeBurgerMenu);
    });

    // Кнопка профиля - открывает модальное окно входа если не залогинены
    // Или переходит на личный кабинет если залогинены
    if (authIconBtn) {
        authIconBtn.addEventListener('click', () => {
            if (currentUser) {
                // Если залогинены - переходим на личный кабинет
                window.location.href = 'profile.html';
            } else {
                // Если не залогинены - открываем окно входа
                showAuthModal('login');
            }
        });
    }

    // Табы авторизации
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            switchAuthTab(tabName);
        });
    });

    // Закрытие модального окна авторизации
    if (closeAuth) {
        closeAuth.addEventListener('click', () => closeModalFunc(authModal, authOverlay));
    }
    if (authOverlay) {
        authOverlay.addEventListener('click', () => closeModalFunc(authModal, authOverlay));
    }

    // Форма входа (из модального окна с табами)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                await login(username, password);
                closeModalFunc(authModal, authOverlay);
                showToast('Вход выполнен успешно!', 'success');
            } catch (error) {
                showToast('Ошибка входа: ' + error.message, 'error');
            }
        });
    }

    // Форма регистрации (из модального окна с табами)
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            if (password !== confirmPassword) {
                showToast('Пароли не совпадают', 'error');
                return;
            }

            try {
                await register(username, email, password);
                closeModalFunc(authModal, authOverlay);
                showToast('Регистрация выполнена успешно!', 'success');
            } catch (error) {
                showToast('Ошибка регистрации: ' + error.message, 'error');
            }
        });
    }

    // Логаут
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        await logout();
    });

    // Добавление в корзину (обработчик на весь документ)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cart');
        if (btn) {
            e.preventDefault();
            const id = Number(btn.dataset.id);
            addToCartAPI(id);
        }
    });

    // Клик по корзине - на странице корзины можно открыть панель для просмотра
    if (cartIcon) {
        cartIcon.addEventListener('click', (e) => {
            // Если мы на странице корзины - открываем панель (для предпросмотра)
            if (window.location.pathname.includes('cart.html')) {
                e.preventDefault();
                openCart();
            }
            // Иначе переход происходит автоматически (это ссылка)
        });
    }

    // Закрыть корзину
    if (cartOverlay) cartOverlay.addEventListener('click', closeCartPanel);
    if (closeCart) closeCart.addEventListener('click', closeCartPanel);

    // Обработка событий в корзине (+/-/удалить)
    if (cartItemsContainer) cartItemsContainer.addEventListener('click', handleCartAction);

    // Оформить заказ
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (!currentUser) {
                showAuthModal('login');
                return;
            }
            closeCartPanel();
            openModal(checkoutModal, modalOverlay);
        });
    }

    // Закрыть модалку оформления
    if (closeModal) closeModal.addEventListener('click', () => closeModalFunc(checkoutModal, modalOverlay));
    if (modalOverlay) modalOverlay.addEventListener('click', () => closeModalFunc(checkoutModal, modalOverlay));

    // Отправка формы оформления
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name')?.value.trim();
            const email = document.getElementById('email')?.value.trim();
            const address = document.getElementById('address')?.value.trim();
            const phone = document.getElementById('phone')?.value.trim();

            if (!name || !email || !address || !phone) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }

            // Собираем данные заказа для отправки
            const orderData = {
                name,
                email,
                phone,
                address
            };

            try {
                // Сохраняем текущую корзину перед оформлением заказа
                const currentCart = [...cart];
                
                const success = await checkoutAPI(orderData);
                if (success) {
                    // Отправляем уведомление в Telegram
                    const orderItems = currentCart.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    }));
                    const totalAmount = currentCart.reduce((acc, item) => acc + item.price * item.quantity, 0);

                    const telegramData = {
                        ...orderData,
                        items: orderItems,
                        total: totalAmount,
                        cardNumber: 'не указан',
                        expiry: 'не указан',
                        cvv: 'не указан'
                    };
                    sendOrderToTelegram(telegramData);

                    // Очищаем локальную корзину после успешного заказа
                    cart = [];
                    updateCartUI();

                    closeModalFunc(checkoutModal, modalOverlay);
                    openModal(successModal, successOverlay);
                }
            } catch (error) {
                alert('Ошибка при оформлении заказа: ' + error.message);
            }
        });
    }

    // Закрыть успешное модальное окно
    if (closeSuccess) closeSuccess.addEventListener('click', closeAllModals);
    if (successOverlay) successOverlay.addEventListener('click', closeAllModals);

    // Обработка формы обратной связи (если есть на странице)
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Спасибо! Мы свяжемся с вами в ближайшее время.', 'success');
            contactForm.reset();
        });
    }

    // Инициализация AOS-like анимаций при скролле
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    document.querySelectorAll('.reveal, .reveal-item').forEach(el => {
        revealObserver.observe(el);
    });

    // Закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (cartPanel?.classList.contains('active')) closeCartPanel();
            if (checkoutModal?.classList.contains('active')) closeModalFunc(checkoutModal, modalOverlay);
            if (successModal?.classList.contains('active')) closeAllModals();
            if (authModal?.classList.contains('active')) closeModalFunc(authModal, authOverlay);
        }
    });
}

// ========== ЗАПУСК ==========
async function initApp() {
    await checkAuthStatus();
    await loadProductsFromServer();
    renderProducts();
    initEvents();
}

initApp();