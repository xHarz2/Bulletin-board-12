// Фреймворк: Vue 3 (через CDN). Обрано Vue, бо він підключається одним тегом <script>
// і не потребує Babel для JSX, а шаблони схожі на звичайний HTML.

// Адреса API з оголошеннями (JSONPlaceholder, мок-дані)
const API_URL = 'https://jsonplaceholder.typicode.com/posts?userId=3';

const DESCRIPTION_MAX = 200;

// Скільки мілісекунд нове оголошення має позначку "Нове" (3 с показ + 1 с згасання в CSS)
const NEW_BADGE_TIME = 4000;

// Модель збереженого оголошення: { id, title, category, description, date }
// id - число (Date.now()), date - рядок у форматі РРРР-ММ-ДД

// ----- localStorage -----

const LS_KEY = 'boardPosts';
const LS_MIGRATED_KEY = 'boardPostsMigrated';

// Зберігає масив оголошень у localStorage
function saveToLocalStorage(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// Читає масив оголошень з localStorage (порожній масив, якщо даних немає або вони пошкоджені)
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error('Пошкоджені дані в localStorage:', error);
        return [];
    }
}

// ----- IndexedDB -----

const DB_NAME = 'NeighborhoodBoardDB';
const DB_VERSION = 1;
const STORE_NAME = 'posts';

// Відкриває базу; при першому запуску створює сховище posts з ключем id
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Додає оголошення (put також оновлює запис з тим самим id)
async function addItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Оновлення наявного оголошення - той самий put з тим самим id
async function updateItem(item) {
    return addItem(item);
}

// Повертає всі оголошення зі сховища
async function getAllItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Видаляє оголошення за id
async function deleteItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Одноразове перенесення даних з localStorage в IndexedDB
async function migrateFromLocalStorage() {
    if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') {
        return;
    }

    const stored = await getAllItems();
    const oldItems = loadFromLocalStorage();

    if (stored.length === 0 && oldItems.length > 0) {
        for (const item of oldItems) {
            await addItem(item);
        }
        // Позначаємо, що міграцію виконано, щоб не повторювати її
        localStorage.setItem(LS_MIGRATED_KEY, 'true');
        console.log(`Перенесено з localStorage в IndexedDB: ${oldItems.length}`);
    }
}

// Скільки днів минуло від дати публікації
function daysSince(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString + 'T00:00:00');
    return Math.round((today - date) / (1000 * 60 * 60 * 24));
}

// Сьогоднішня дата у форматі РРРР-ММ-ДД
function todayString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

// Функцію renderAds() з практичної №7 видалено: список тепер рендерить
// компонент AdCard через v-for, без createElement та innerHTML.

// Компонент картки оголошення
const AdCard = {
    props: {
        id: Number,
        title: String,
        category: String,
        description: String,
        daysAgo: Number,
        deletable: Boolean,
        isNew: Boolean
    },
    emits: ['delete'],
    data() {
        // Локальний прапорець: чи розгорнуто опис
        return { expanded: false };
    },
    computed: {
        // Заголовок, скорочений до 30 символів
        shortTitle() {
            return this.title.length > 30 ? this.title.slice(0, 30) + '...' : this.title;
        },
        // Клас бейджа залежно від категорії
        badgeClass() {
            const classes = {
                'Речі': 'badge-items',
                'Послуги': 'badge-services',
                'Тварини': 'badge-animals',
                'З мережі': 'badge-online'
            };
            return classes[this.category] || '';
        },
        imgSrc() {
            const imgText = this.title.split(' ')[0];
            return `https://placehold.co/400x200/EEE/31343C?text=${imgText}`;
        }
    },
    template: `
        <article class="card" :class="{ outdated: daysAgo > 14, 'card--new': isNew }">
            <div class="card-badges">
                <span class="badge" :class="badgeClass">{{ category }}</span>
                <span v-if="isNew" class="badge badge-new">Нове</span>
            </div>
            <h3>{{ shortTitle }}</h3>
            <img :src="imgSrc" :alt="title">

            <div class="card-actions">
                <button v-if="description" type="button" class="btn-details" @click="expanded = !expanded">
                    {{ expanded ? 'Сховати деталі' : 'Показати деталі' }}
                </button>
                <button v-if="deletable" type="button" class="btn-delete" @click="$emit('delete', id)">
                    Видалити
                </button>
            </div>
            <p v-if="expanded" class="card-description">{{ description }}</p>

            <p v-if="daysAgo !== undefined">Опубліковано днів тому: {{ daysAgo }}</p>
        </article>
    `
};

// Головний застосунок: оголошення з API і збережені оголошення користувача
const app = Vue.createApp({
    components: { AdCard },
    data() {
        return {
            apiAds: [],
            savedAds: [],
            loading: false,
            errorMessage: '',
            storageMessage: '',
            useIndexedDB: true,
            newAdId: null
        };
    },
    computed: {
        // Усі оголошення для показу: спочатку збережені (найновіші вгорі), потім з API
        ads() {
            const saved = [...this.savedAds]
                .sort((a, b) => b.id - a.id)
                .map(ad => ({
                    ...ad,
                    daysAgo: daysSince(ad.date),
                    deletable: true,
                    isNew: ad.id === this.newAdId
                }));
            return [...saved, ...this.apiAds];
        },
        // Кількість активних оголошень перераховується автоматично
        activeCount() {
            return this.ads.filter(ad => !(ad.daysAgo > 14)).length;
        }
    },
    methods: {
        // Завантаження оголошень з API JSONPlaceholder (як у практичній №9)
        async loadData() {
            this.loading = true;
            this.errorMessage = '';

            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    throw new Error(`Сервер відповів кодом ${response.status}`);
                }
                const data = await response.json();

                this.apiAds = data.map(post => ({
                    id: post.id,
                    title: post.title,
                    category: 'З мережі',
                    description: post.body
                }));
            } catch (error) {
                this.errorMessage = 'Оголошення тимчасово недоступні. Спробуйте пізніше.';
                console.error('Помилка завантаження оголошень:', error);
            } finally {
                this.loading = false;
            }
        },
        // Відкриття бази, міграція і перше читання збережених оголошень
        async initStorage() {
            try {
                await openDB();
                await migrateFromLocalStorage();
                this.savedAds = await getAllItems();
            } catch (error) {
                // IndexedDB недоступна - працюємо тільки з localStorage
                this.useIndexedDB = false;
                this.storageMessage = 'Локальна база даних недоступна, оголошення зберігаються лише в localStorage.';
                console.error('Помилка відкриття IndexedDB:', error);
                this.savedAds = loadFromLocalStorage();
            }
        },
        // Перечитує збережені оголошення зі сховища
        async refreshSaved() {
            if (this.useIndexedDB) {
                this.savedAds = await getAllItems();
            }
            saveToLocalStorage(this.savedAds);
        },
        // Додавання оголошення з форми
        async addAd(ad) {
            const newAd = { id: Date.now(), ...ad };
            try {
                if (this.useIndexedDB) {
                    await addItem(newAd);
                } else {
                    this.savedAds = [...this.savedAds, newAd];
                }
                await this.refreshSaved();
                this.showNewAd(newAd.id);
            } catch (error) {
                this.storageMessage = 'Не вдалося зберегти оголошення.';
                console.error('Помилка збереження:', error);
            }
        },
        // Позначає оголошення як нове: картка з'являється з анімацією,
        // а через NEW_BADGE_TIME позначку "Нове" прибираємо
        showNewAd(id) {
            this.newAdId = id;
            clearTimeout(this.newBadgeTimer);
            this.newBadgeTimer = setTimeout(() => {
                this.newAdId = null;
            }, NEW_BADGE_TIME);

            // Прокручуємо до початку стрічки, щоб було видно нове оголошення
            this.$nextTick(() => {
                this.$refs.listTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        },
        // Видалення оголошення за id
        async deleteAd(id) {
            try {
                if (this.useIndexedDB) {
                    await deleteItem(id);
                } else {
                    this.savedAds = this.savedAds.filter(ad => ad.id !== id);
                }
                await this.refreshSaved();
            } catch (error) {
                this.storageMessage = 'Не вдалося видалити оголошення.';
                console.error('Помилка видалення:', error);
            }
        }
    },
    mounted() {
        this.initStorage();
        this.loadData();
    },
    unmounted() {
        clearTimeout(this.newBadgeTimer);
    },
    template: `
        <div class="list-controls" ref="listTop">
            <button type="button" class="btn-reload" :disabled="loading" @click="loadData">Оновити</button>
            <p class="load-status" :class="{ error: errorMessage }" role="status">
                {{ loading ? 'Завантаження...' : errorMessage }}
            </p>
        </div>

        <p v-if="storageMessage" class="storage-status">{{ storageMessage }}</p>

        <p id="listings-count">Активних оголошень: {{ activeCount }}</p>

        <div class="cards-grid">
            <ad-card
                v-for="ad in ads"
                :key="ad.id"
                :id="ad.id"
                :title="ad.title"
                :category="ad.category"
                :description="ad.description"
                :days-ago="ad.daysAgo"
                :deletable="ad.deletable"
                :is-new="ad.isNew"
                @delete="deleteAd"
            ></ad-card>
        </div>
    `
});

const adsApp = app.mount('#ads-app');

// ----- Форма додавання (з практичної №8) -----

const form = document.querySelector('#add-ad-form');
const titleInput = document.querySelector('#ad-title');
const categorySelect = document.querySelector('#ad-category');
const descriptionInput = document.querySelector('#ad-description');
const dateInput = document.querySelector('#ad-date');
const counterElement = document.querySelector('#description-counter');
const toggleFormBtn = document.querySelector('#toggle-form-btn');

// За замовчуванням дата - сьогодні, майбутню дату обрати не можна
function resetDate() {
    dateInput.value = todayString();
    dateInput.max = todayString();
}
resetDate();

// Оновлює лічильник символів, що залишилися в описі
function updateCounter() {
    const left = DESCRIPTION_MAX - descriptionInput.value.length;
    counterElement.textContent = `Залишилось символів: ${left}`;
}

// Клік на "Додати оголошення" - показує або ховає форму
toggleFormBtn.addEventListener('click', () => {
    form.classList.toggle('visible');

    if (form.classList.contains('visible')) {
        toggleFormBtn.textContent = 'Сховати форму';
        form.scrollIntoView({ behavior: 'smooth' });
        titleInput.focus();
    } else {
        toggleFormBtn.textContent = 'Додати оголошення';
    }
});

// Лічильник символів оновлюється на кожне натискання клавіші
descriptionInput.addEventListener('input', updateCounter);

// Заголовок не може складатися лише з пробілів
titleInput.addEventListener('input', () => {
    if (titleInput.value !== '' && titleInput.value.trim() === '') {
        titleInput.setCustomValidity('Заголовок не може складатися лише з пробілів');
    } else {
        titleInput.setCustomValidity('');
    }
});

// Надсилання форми: нове оголошення зберігається в IndexedDB, список оновиться сам
form.addEventListener('submit', event => {
    event.preventDefault();

    adsApp.addAd({
        title: titleInput.value.trim(),
        category: categorySelect.value,
        description: descriptionInput.value.trim(),
        date: dateInput.value
    });

    form.reset();
    resetDate();
    updateCounter();
});
