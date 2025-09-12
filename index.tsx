/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FIX: Replaced JSDoc @typedef with a TypeScript type alias for better type recognition in a .tsx file.
type CardId = 'card-home' | 'card-chat' | 'card-tasks' | 'card-notes' | 'card-settings' | 'card-gadgets' | 'card-inbox';

/**
 * Configuration for each card application.
 * @type {Object.<CardId, {title: string, iconId: string}>}
 */
const CARD_CONFIG = {
    'card-home': { title: 'Home', iconId: '' }, // Home doesn't have an icon in switcher
    'card-chat': { title: 'Assistant', iconId: 'assistant-icon' },
    'card-inbox': { title: 'Inbox', iconId: 'inbox-icon' },
    'card-tasks': { title: 'Tasks', iconId: 'tasks-icon' },
    'card-notes': { title: 'Notes', iconId: 'notes-icon' },
    'card-settings': { title: 'Settings', iconId: 'settings-icon' },
    'card-gadgets': { title: 'Gadgets', iconId: 'gadgets-icon' },
};

/**
 * Interface to the backend server. All data and AI interactions go through this object.
 * @namespace
 */
const BackendAPI = {
    isInitialized: false,
    baseUrl: 'http://localhost:3001/api',

    keys: {
        settings: 'assistant-settings', // For client-side UI settings like theme
    },

    /**
     * Pings the backend to ensure it's running and initializes the connection.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Ping the server to check for a connection
            await this._fetch('/system-status');
            this.isInitialized = true;
            console.log('BackendAPI Connected.');
        } catch (error) {
            console.error('Failed to connect to BackendAPI:', error);
            UIManager.showSystemMessageInChat('Could not connect to the backend. Please ensure the server is running (e.g., from the `backend` directory, run `npm install` then `npm start`) and refresh the page.');
            document.querySelectorAll('input, button').forEach(el => (el as HTMLInputElement).disabled = true);
        }
    },
    
    // Generic fetch wrapper for API calls
    async _fetch(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            if (response.status === 204) { // No Content
                return null;
            }
            return response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            UIManager.showSystemMessageInChat(`API Error: ${error.message}`);
            throw error;
        }
    },


    chat: {
        /**
         * Calls the backend to start a streaming chat session.
         */
        async stream(userInput, context, template, onChunk, shouldStop) {
            try {
                const response = await fetch(`${BackendAPI.baseUrl}/chat/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userInput, context, template }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    if (shouldStop()) {
                        await reader.cancel();
                        break;
                    }
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunkText = decoder.decode(value);
                    onChunk(chunkText);
                }

            } catch (error) {
                console.error('API Call to /api/chat/stream failed:', error);
                UIManager.showSystemMessageInChat('Failed to send message. Please try again.');
                throw error;
            }
        },
        /**
         * Simulates a call to POST /api/chat/quick-query
         */
        async quickQuery(userInput) {
            try {
                const data = await BackendAPI._fetch('/quick-query', {
                    method: 'POST',
                    body: JSON.stringify({ query: userInput }),
                });
                return data; // May contain { response, action }
            } catch (error) {
                return { response: 'Sorry, something went wrong with the quick query.' };
            }
        },
        async getHistory() {
            return BackendAPI._fetch('/chat/history');
        },
        async clearHistory() {
            return BackendAPI._fetch('/chat/history', { method: 'DELETE' });
        },
        async suggest(text) {
            try {
                 const data = await BackendAPI._fetch('/chat/suggest', {
                    method: 'POST',
                    body: JSON.stringify({ text }),
                });
                return data.suggestions || [];
            } catch (error) {
                return []; // Fail silently
            }
        }
    },
    
    messages: {
        async list() {
            return BackendAPI._fetch('/messages');
        },
        async create(text) {
            // Creating a "message" is equivalent to hitting the webhook endpoint
            return BackendAPI._fetch('/webhook', {
                method: 'POST',
                body: JSON.stringify({ message: text }),
            });
        },
        async delete(id) {
            return BackendAPI._fetch(`/messages/${id}`, { method: 'DELETE' });
        }
    },

    tasks: {
        async list() { return BackendAPI._fetch('/tasks'); },
        async create(title, priority) {
            return BackendAPI._fetch('/tasks', {
                method: 'POST',
                body: JSON.stringify({ title, priority }),
            });
        },
        async update(id, completed) {
             return BackendAPI._fetch(`/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ completed }),
            });
        },
        async delete(id) {
             return BackendAPI._fetch(`/tasks/${id}`, { method: 'DELETE' });
        },
    },

    notes: {
        async list() { return BackendAPI._fetch('/notes'); },
        async create(content) {
            return BackendAPI._fetch('/notes', {
                method: 'POST',
                body: JSON.stringify({ content }),
            });
        },
    },
    
    // New APIs for Phase 3
    widgets: {
        async list() { return BackendAPI._fetch('/widgets'); }
    },

    expenses: {
        async list() { return BackendAPI._fetch('/expenses'); },
        async create(expense) {
            return BackendAPI._fetch('/expenses', {
                method: 'POST',
                body: JSON.stringify(expense),
            });
        },
        async getSummary() { return BackendAPI._fetch('/expenses/summary'); }
    },
    
    system: {
        async getStatus() { return BackendAPI._fetch('/system-status'); }
    },
    
    activityLog: {
        async list() { return BackendAPI._fetch('/activity-log'); }
    },


    settings: {
        async get() {
            const settingsData = localStorage.getItem(BackendAPI.keys.settings);
            const parsedData = settingsData ? JSON.parse(settingsData) : {};
            return {
                theme: parsedData.theme || 'dark',
                persistentContext: parsedData.persistentContext || '',
                templates: parsedData.templates || [],
                apiKeys: parsedData.apiKeys || [],
            };
        },
        async update(newSettings) {
            const currentSettings = await this.get();
            const updatedSettings = { ...currentSettings, ...newSettings };
            localStorage.setItem(BackendAPI.keys.settings, JSON.stringify(updatedSettings));
            return { success: true };
        }
    },
    
    apiKeys: {
        async list() {
            const settings = await BackendAPI.settings.get();
            return settings.apiKeys;
        },
        async create(name, value) {
            const settings = await BackendAPI.settings.get();
            const newKey = { id: `key-${Date.now()}`, name, value };
            const updatedKeys = [...settings.apiKeys, newKey];
            await BackendAPI.settings.update({ apiKeys: updatedKeys });
            return newKey;
        },
        async delete(id) {
            const settings = await BackendAPI.settings.get();
            const updatedKeys = settings.apiKeys.filter(key => key.id !== id);
            await BackendAPI.settings.update({ apiKeys: updatedKeys });
            return { success: true };
        }
    }
};

/**
 * Manages all UI interactions, state, and DOM manipulation.
 * @namespace
 */
const UIManager = {
    // DOM element references
    elements: {
        mainContainer: document.getElementById('main-container'),
        walletContainer: document.getElementById('wallet-container'),
        panePrimary: document.getElementById('pane-primary'),
        paneSecondary: document.getElementById('pane-secondary'),
        appSwitcher: document.getElementById('app-switcher'),
        appSwitcherOverlay: document.getElementById('app-switcher-overlay'),
        switcherGrid: document.getElementById('switcher-grid'),
        swipeUpHandle: document.getElementById('swipe-up-handle'),
        quickSwitchContainer: document.getElementById('quick-switch-container'),
        quickSwitchOverlay: document.getElementById('quick-switch-overlay'),
        confirmationToast: document.getElementById('confirmation-toast'),
        chatSettingsModal: document.getElementById('chat-settings-modal'),
        chatSettingsModalOverlay: document.getElementById('chat-settings-modal-overlay'),
    },

    // UI State
    state: {
        /** @type {CardId | null} */
        primaryPaneCard: null,
        /** @type {CardId | null} */
        secondaryPaneCard: null,
        isSplitView: false,
        isAppSwitcherOpen: false,
        isQuickSwitchOpen: false,
        /** @type {'primary' | 'secondary' | null} */
        paneTargetForSwitcher: null,
        cardHistory: [] as CardId[],
    },

    /**
     * Initializes the entire UI, binding events and setting up the initial layout.
     */
    initialize() {
        this.updateLayout();
        this.populateWallet();
        this.bindGlobalEvents();
        this.openCard('card-home', 'primary');
    },
    
    /**
     * Populates the mobile wallet view with cards from templates.
     */
    populateWallet() {
        const cardOrder = ['card-gadgets', 'card-settings', 'card-notes', 'card-tasks', 'card-inbox', 'card-chat', 'card-home'];
        cardOrder.forEach(cardId => {
            const cardElement = this.cloneCardTemplate(cardId as CardId);
            if (cardElement) {
                cardElement.addEventListener('click', () => {
                     if (!this.elements.walletContainer.classList.contains('is-active')) {
                        this.elements.walletContainer.classList.add('is-active');
                        this.elements.walletContainer.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
                        cardElement.classList.add('active');
                        document.body.classList.add('wallet-card-active');
                        this.bindCardAppLogic(cardElement);
                     }
                });
                this.elements.walletContainer.appendChild(cardElement);
            }
        });
    },

    /**
     * Binds global event listeners (resize, app switcher gestures, etc.).
     */
    bindGlobalEvents() {
        window.addEventListener('resize', () => this.updateLayout());
        
        // App Switcher Logic
        this.populateAppSwitcher();
        const openSwitcher = () => {
            this.updateSwitcherActiveState();
            document.body.classList.add('app-switcher-active');
            this.state.isAppSwitcherOpen = true;
        };
        const closeSwitcher = () => {
            document.body.classList.remove('app-switcher-active');
            this.state.isAppSwitcherOpen = false;
            this.state.paneTargetForSwitcher = null; // Reset target
        };

        this.elements.swipeUpHandle.addEventListener('click', openSwitcher);
        this.elements.appSwitcherOverlay.addEventListener('click', closeSwitcher);

        // Quick Switch Logic
        this.elements.quickSwitchOverlay.addEventListener('click', () => this.closeQuickSwitch());
        this.bindSwipeGestures();
    },

    /**
     * Binds swipe gesture listeners to the wallet container for card navigation.
     */
    bindSwipeGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        const swipeThreshold = 50; // pixels
    
        this.elements.walletContainer.addEventListener('touchstart', (e) => {
            // Only initiate swipe on an active card in mobile view
            const activeCard = (e.target as HTMLElement).closest('.card.active');
            if (!activeCard || this.state.isSplitView) return;
    
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
    
        this.elements.walletContainer.addEventListener('touchend', (e) => {
            const activeCard = (e.target as HTMLElement).closest('.card.active');
            if (!activeCard || touchStartX === 0 || this.state.isSplitView) return;
    
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
    
            // Reset for next touch
            touchStartX = 0;
    
            // Check for a clear horizontal swipe
            if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                if (deltaX > 0) { // Swipe Right
                    this.handleSwipeRight(activeCard);
                } else { // Swipe Left
                    this.handleSwipeLeft();
                }
            }
        });
    },

    handleSwipeRight(activeCardEl) {
        const cardId = activeCardEl.dataset.cardId as CardId;
        this.openQuickSwitch(cardId);
    },

    handleSwipeLeft() {
        this.navigateBack();
    },

    /**
     * Checks window dimensions and applies the appropriate layout (wallet or split-view).
     */
    updateLayout() {
        const isLandscape = window.matchMedia("(min-width: 768px) and (orientation: landscape)").matches;
        this.state.isSplitView = isLandscape;
        document.body.classList.toggle('split-view-mode', isLandscape);
        
        // If switching layout, re-render the panes to match the current state
        if (isLandscape) {
            this.elements.walletContainer.classList.remove('is-active');
            document.body.classList.remove('wallet-card-active');
            this.renderPanes();
        } else {
            this.clearPanes();
            if (this.state.primaryPaneCard) {
                 this.elements.walletContainer.classList.add('is-active');
                 document.body.classList.add('wallet-card-active');
                 this.elements.walletContainer.querySelectorAll('.card').forEach(c => {
                    // FIX: Property 'dataset' does not exist on type 'Node'. Cast to HTMLElement.
                     const isActive = (c as HTMLElement).dataset.cardId === this.state.primaryPaneCard;
                     c.classList.toggle('active', isActive);
                 });
            }
        }
    },
    
    /**
     * Renders the primary and secondary panes based on the current UI state.
     */
    renderPanes() {
        this.clearPanes();
        if (this.state.primaryPaneCard) {
            this.addCardToPane(this.state.primaryPaneCard, 'primary');
        }
        if (this.state.secondaryPaneCard) {
            this.addCardToPane(this.state.secondaryPaneCard, 'secondary');
        }
        this.elements.panePrimary.classList.toggle('active', !!this.state.primaryPaneCard);
        this.elements.paneSecondary.classList.toggle('active', !!this.state.secondaryPaneCard);
    },

    /**
     * Opens a card, deciding whether to place it in a pane or the mobile wallet.
     * @param {CardId} cardId - The ID of the card to open.
     * @param {'primary' | 'secondary'} targetPane - The target pane for the card.
     * @param {{isBackNavigation?: boolean}} [options] - Optional flags for navigation type.
     */
    openCard(cardId, targetPane, options) {
        if (!options?.isBackNavigation) {
            if (this.state.cardHistory[this.state.cardHistory.length - 1] !== cardId) {
                this.state.cardHistory.push(cardId);
                if (this.state.cardHistory.length > 20) { // Cap history size
                    this.state.cardHistory.shift();
                }
            }
        }

        if (targetPane === 'primary') {
            this.state.primaryPaneCard = cardId;
            // In split view, if primary changes, secondary might need to be closed.
            if (this.state.isSplitView && this.state.secondaryPaneCard === cardId) {
                this.state.secondaryPaneCard = null;
            }
        } else {
            // Can't open in secondary if primary is empty or same card
            if (!this.state.primaryPaneCard || this.state.primaryPaneCard === cardId) return;
            this.state.secondaryPaneCard = cardId;
        }

        if (this.state.isSplitView) {
            this.renderPanes();
        } else {
            // Mobile view logic
            document.body.classList.add('wallet-card-active');
            this.elements.walletContainer.classList.add('is-active');
            this.elements.walletContainer.querySelectorAll('.card').forEach(c => {
                 const elCardId = c.getAttribute('data-card-id');
                 const isActive = elCardId === cardId;
                 c.classList.toggle('active', isActive);
                 if (isActive) this.bindCardAppLogic(c as HTMLElement);
            });
        }
    },

    /**
     * Navigates to the previously viewed card.
     */
    navigateBack() {
        if (this.state.isSplitView || this.state.cardHistory.length <= 1) return;
        
        this.state.cardHistory.pop(); // Remove current card
        const previousCardId = this.state.cardHistory[this.state.cardHistory.length - 1];
        this.openCard(previousCardId, 'primary', { isBackNavigation: true });
    },

    /**
     * Opens the Quick Switch UI to show previous cards.
     * @param {CardId} baseCardId The card from which the gesture originated.
     */
    openQuickSwitch(baseCardId) {
        const cardOrder = ['card-gadgets', 'card-settings', 'card-notes', 'card-tasks', 'card-inbox', 'card-chat', 'card-home'];
        const activeCardEl = this.elements.walletContainer.querySelector('.card.active');
    
        const baseIndex = cardOrder.indexOf(baseCardId);
        if (baseIndex < 1) return; // Can't open if it's the last card or not found
    
        const cardsToShow = [];
        // Get up to 4 cards "behind" the current one in the stack
        for (let i = 1; i <= 4; i++) {
            const prevIndex = baseIndex - i;
            if (prevIndex >= 0) {
                cardsToShow.push(cardOrder[prevIndex]);
            } else {
                break;
            }
        }
    
        if (cardsToShow.length === 0) return;
    
        this.elements.quickSwitchContainer.innerHTML = ''; // Clear previous
        cardsToShow.forEach(cardId => {
            const config = CARD_CONFIG[cardId];
            const item = document.createElement('button');
            item.className = 'quick-switch-card';
            item.setAttribute('aria-label', `Open ${config.title}`);
            
            const iconSvg = document.getElementById(config.iconId)?.cloneNode(true);
            const label = document.createElement('span');
            label.textContent = config.title;
    
            if(iconSvg) item.appendChild(iconSvg);
            item.appendChild(label);
    
            item.addEventListener('click', () => {
                this.closeQuickSwitch();
                this.openCard(cardId as CardId, 'primary', { isBackNavigation: false });
            });
            this.elements.quickSwitchContainer.appendChild(item);
        });
        
        activeCardEl?.classList.add('is-switching');
        document.body.classList.add('quick-switch-active');
        this.state.isQuickSwitchOpen = true;
    },

    /**
     * Closes the Quick Switch UI.
     */
    closeQuickSwitch() {
        if (!this.state.isQuickSwitchOpen) return;
        const activeCardEl = this.elements.walletContainer.querySelector('.card.active');
        document.body.classList.remove('quick-switch-active');
        
        // Remove the switching class after a small delay to allow the card to animate back in
        setTimeout(() => {
            activeCardEl?.classList.remove('is-switching');
        }, 50);
        this.state.isQuickSwitchOpen = false;
    },


    /**
     * Adds a cloned card to the specified pane and wires up its logic.
     * @param {CardId} cardId - The ID of the card template to clone.
     * @param {'primary' | 'secondary'} pane - The target pane.
     */
    addCardToPane(cardId, pane) {
        const paneEl = pane === 'primary' ? this.elements.panePrimary : this.elements.paneSecondary;
        if (!paneEl) return;
        
        paneEl.innerHTML = '';
        const cardClone = this.cloneCardTemplate(cardId);
        if (cardClone) {
            paneEl.appendChild(cardClone);
            this.bindCardAppLogic(cardClone);
        }
    },
    
    /**
     * Clears all content from the panes.
     */
    clearPanes() {
        this.elements.panePrimary.innerHTML = '';
        this.elements.paneSecondary.innerHTML = '';
    },

    /**
     * Creates a card element from its HTML template.
     * @param {CardId} cardId - The ID of the card template.
     * @returns {HTMLElement | null} The cloned card element.
     */
    cloneCardTemplate(cardId) {
        const template = document.getElementById(`template-${cardId}`);
        if (template instanceof HTMLTemplateElement) {
            const card = template.content.firstElementChild.cloneNode(true) as HTMLElement;
            card.dataset.cardId = cardId;
            this.addCardControls(card, cardId);
            return card;
        }
        return null;
    },
    
    /**
     * Adds the standard window-like controls to a card element.
     * @param {HTMLElement} cardEl - The card element.
     * @param {CardId} cardId - The ID of the card.
     */
    addCardControls(cardEl, cardId) {
        const controlsContainer = cardEl.querySelector('.card-controls');
        if (!controlsContainer) return;

        // Close/Minimize Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'card-control-btn close';
        closeBtn.ariaLabel = 'Close';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.state.isSplitView) {
                // Determine which pane this card is in and close it
                const parentPane = cardEl.closest('.pane');
                if (parentPane?.id === 'pane-primary') {
                    // This is complex: what should happen? Maybe close both? For now, let's close secondary.
                    this.state.secondaryPaneCard = null;
                } else {
                    this.state.secondaryPaneCard = null;
                }
                this.renderPanes();
            } else {
                document.body.classList.remove('wallet-card-active');
                this.elements.walletContainer.classList.remove('is-active');
                cardEl.classList.remove('active');
            }
        });
        
        // Split View Button
        const splitBtn = document.createElement('button');
        splitBtn.className = 'card-control-btn split-view';
        splitBtn.ariaLabel = 'Add to Split View';
        splitBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7v14"/></svg>';
        splitBtn.addEventListener('click', (e) => {
             e.stopPropagation();
             this.state.paneTargetForSwitcher = 'secondary';
             document.body.classList.add('app-switcher-active');
        });


        controlsContainer.appendChild(splitBtn);
        controlsContainer.appendChild(closeBtn);
    },
    
    /**
     * Creates a single item for the app switcher grid.
     * @param {string} title - The accessible label and text for the item.
     * @param {string} iconId - The ID of the SVG icon to clone.
     * @param {string | null} cardId - The card ID this item corresponds to.
     * @returns {HTMLButtonElement | null}
     */
    createSwitcherItem(title, iconId, cardId = null) {
        const iconSvg = document.getElementById(iconId)?.cloneNode(true);
        if (!iconSvg) return null;

        const item = document.createElement('button');
        item.className = 'switcher-item';
        item.setAttribute('aria-label', title);
        if (cardId) {
            item.dataset.cardId = cardId;
        }
        
        const iconContainer = document.createElement('div');
        iconContainer.appendChild(iconSvg);
        item.appendChild(iconContainer);
        
        const label = document.createElement('span');
        label.className = 'switcher-item-label';
        label.textContent = title;
        item.appendChild(label);
        
        return item;
    },

    /**
     * Populates the app switcher grid with items for each card.
     */
    populateAppSwitcher() {
        // Add Home/Wallet button first
        const homeItem = this.createSwitcherItem('Home', 'cards-icon', 'card-home');
        if (homeItem) {
            homeItem.addEventListener('click', () => {
                document.body.classList.remove('wallet-card-active');
                this.elements.walletContainer.classList.remove('is-active');
                this.elements.walletContainer.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
                
                document.body.classList.remove('app-switcher-active');
                this.state.paneTargetForSwitcher = null;
                // Since home is now a view, we need to set the state correctly
                this.state.primaryPaneCard = 'card-home';
            });
            this.elements.switcherGrid.appendChild(homeItem);
        }

        Object.keys(CARD_CONFIG).forEach(cardId => {
            const config = CARD_CONFIG[cardId as CardId];
            if (!config.iconId) return;

            const item = this.createSwitcherItem(config.title, config.iconId, cardId);
            if(item) {
                item.addEventListener('click', () => {
                    const target = this.state.paneTargetForSwitcher || 'primary';
                    this.openCard(cardId as CardId, target, { isBackNavigation: false });
                    document.body.classList.remove('app-switcher-active');
                    this.state.paneTargetForSwitcher = null;
                });
                this.elements.switcherGrid.appendChild(item);
            }
        });
    },

    /**
     * Updates the active state of items in the app switcher grid.
     */
    updateSwitcherActiveState() {
        const currentCardId = this.state.primaryPaneCard;
        this.elements.switcherGrid.querySelectorAll('.switcher-item').forEach(item => {
            const el = item as HTMLElement;
            // The "Home" button is active if the wallet is not active or if the home card is shown.
            const isHomeActive = el.dataset.cardId === 'card-home' && (!this.elements.walletContainer.classList.contains('is-active') || currentCardId === 'card-home');
            const isAppActive = el.dataset.cardId === currentCardId;
            el.classList.toggle('active', isHomeActive || isAppActive);
        });
    },

    /**
     * Binds the specific JS logic for an application to its card element.
     * @param {HTMLElement} cardEl - The card element (clone).
     */
    bindCardAppLogic(cardEl) {
        const cardId = cardEl.dataset.cardId;
        switch (cardId) {
            case 'card-chat':
                ChatApp.initialize(cardEl);
                break;
            case 'card-inbox':
                InboxApp.initialize(cardEl);
                break;
            case 'card-settings':
                SettingsApp.initialize(cardEl);
                break;
            case 'card-tasks':
                TasksApp.initialize(cardEl);
                break;
            case 'card-notes':
                NotesApp.initialize(cardEl);
                break;
            case 'card-home':
                HomeApp.initialize(cardEl);
                break;
            case 'card-gadgets':
                GadgetsApp.initialize(cardEl);
                break;
        }
    },
    
    /**
     * Displays a system message in the active chat log.
     * @param {string} text - The message to display.
     */
    showSystemMessageInChat(text) {
        const chatLog = document.querySelector('#pane-primary #chat-log, #wallet-container .active #chat-log');
        if (chatLog) {
            const messageEl = document.createElement('div');
            messageEl.className = 'message system';
            messageEl.innerHTML = `<p>${text}</p>`;
            // Prepend for column-reverse
            chatLog.prepend(messageEl);
        }
    },

    /**
     * Shows the iOS-style confirmation toast.
     * @param {string} customerMessage
     * @param {string} aiReply
     * @param {() => void} onSend
     * @param {() => void} onCancel
     */
    showConfirmationToast(customerMessage, aiReply, onSend, onCancel) {
        const toast = this.elements.confirmationToast;
        toast.querySelector('#toast-customer-message p').textContent = customerMessage;
        toast.querySelector('#toast-ai-reply p').textContent = aiReply;

        const sendBtn = toast.querySelector('#toast-send-btn');
        const cancelBtn = toast.querySelector('#toast-cancel-btn');

        // Clone and replace to remove old event listeners
        const newSendBtn = sendBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newSendBtn.addEventListener('click', onSend);
        newCancelBtn.addEventListener('click', onCancel);

        toast.classList.add('visible');
    },

    /**
     * Hides the confirmation toast.
     */
    hideConfirmationToast() {
        this.elements.confirmationToast.classList.remove('visible');
    },

    /** Shows the chat settings modal */
    showChatSettingsModal() {
        this.elements.chatSettingsModal.classList.add('visible');
        this.elements.chatSettingsModalOverlay.classList.add('visible');
    },

    /** Hides the chat settings modal */
    hideChatSettingsModal() {
        this.elements.chatSettingsModal.classList.remove('visible');
        this.elements.chatSettingsModalOverlay.classList.remove('visible');
    }
};

/**
 * Logic for the Home card.
 * @namespace
 */
const HomeApp = {
    /**
     * @param {HTMLElement} container - The card element.
     */
    initialize(container) {
        // Quick Access
        const quickAccessForm = container.querySelector('#quick-access-form');
        const quickAccessInput = container.querySelector('#quick-access-input') as HTMLInputElement;
        const quickAccessResponse = container.querySelector('#quick-access-response');
        const quickAccessText = container.querySelector('#quick-access-text');
        const goToChatBtn = container.querySelector('#go-to-chat-btn');

        quickAccessForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = quickAccessInput.value.trim();
            if (!userInput || !BackendAPI.isInitialized) return;
            
            quickAccessInput.disabled = true;
            quickAccessText.textContent = 'Thinking...';
            
            const modelResponse = await BackendAPI.chat.quickQuery(userInput);
            
            quickAccessText.textContent = modelResponse.response;
            quickAccessResponse.classList.add('active');
            quickAccessForm.style.display = 'none'; // Hide form after response
            quickAccessInput.disabled = false;
            
            // Handle intelligent actions from backend
            if (modelResponse.action?.type === 'openCard') {
                UIManager.openCard(modelResponse.action.cardId, 'primary', { isBackNavigation: false });
            }
        });

        goToChatBtn?.addEventListener('click', () => {
             UIManager.openCard('card-chat', 'primary', { isBackNavigation: false });
        });

        // Shortcuts
        const shortcutGrid = container.querySelector('.shortcut-grid');
        shortcutGrid.innerHTML = ''; // Clear any previous
        Object.keys(CARD_CONFIG).forEach(cardId => {
             const config = CARD_CONFIG[cardId as CardId];
             if (!config.iconId) return;

             const button = document.createElement('button');
             button.className = 'shortcut-button';
             button.dataset.target = cardId;
             button.ariaLabel = `Open ${config.title}`;
             
             const icon = document.getElementById(config.iconId)?.cloneNode(true);
             const label = document.createElement('span');
             label.textContent = config.title;
             
             if(icon) button.appendChild(icon);
             button.appendChild(label);
             
             button.addEventListener('click', () => UIManager.openCard(cardId as CardId, 'primary', { isBackNavigation: false }));
             shortcutGrid.appendChild(button);
        });
    }
};

/**
 * Logic for the Chat card.
 * @namespace
 */
const ChatApp = {
    state: {
        templates: [],
        activeTemplateId: null,
        persistentContext: '',
        suggestionTimeout: null,
    },
    
    /**
     * @param {HTMLElement} container - The card element.
     */
    async initialize(container) {
        const chatLog = container.querySelector('#chat-log');
        const chatForm = container.querySelector('#chat-form');
        const chatInput = container.querySelector('#chat-input') as HTMLTextAreaElement;
        const sendButton = container.querySelector('#send-btn') as HTMLButtonElement;
        const stopButton = container.querySelector('#stop-btn') as HTMLButtonElement;
        const settingsBtn = container.querySelector('#chat-settings-btn') as HTMLButtonElement;
        const suggestionsContainer = container.querySelector('#chat-suggestions-container') as HTMLElement;
        const micBtn = container.querySelector('#mic-btn');
        
        if (!chatLog || !chatForm || !chatInput || !sendButton || !stopButton || !settingsBtn) return;
        
        let currentAssistantMessageEl = null;
        let shouldStopGeneration = false;
        
        const settings = await BackendAPI.settings.get();
        this.state.templates = settings.templates;
        this.state.persistentContext = settings.persistentContext;
        
        this.initializeSettingsModal();
        
        const createMessageElement = (sender) => {
            const messageEl = document.createElement('div');
            messageEl.classList.add('message', sender);
            const p = document.createElement('p');
            messageEl.appendChild(p);
            return messageEl;
        };
        
        const appendMessage = (text, sender) => {
            const messageEl = createMessageElement(sender);
            messageEl.querySelector('p').textContent = text;
            chatLog.prepend(messageEl); // Prepend for column-reverse
        };

        const renderHistory = async () => {
            chatLog.innerHTML = '';
            const history = await BackendAPI.chat.getHistory();
            if (!history || history.length === 0) {
                 appendMessage("Hello! I'm your live assistant. How can I help you today?", 'assistant');
                 return;
            }

            // Reverse history to prepend correctly
            [...history].reverse().forEach(msg => {
                const sender = msg.role === 'user' ? 'user' : 'assistant';
                const text = msg.parts.map(part => part.text).join('');
                appendMessage(text, sender);
            });
        };

        const gearIcon = document.getElementById('settings-gear-icon')?.cloneNode(true);
        if (gearIcon && !settingsBtn.querySelector('svg')) {
             settingsBtn.appendChild(gearIcon);
        }

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            UIManager.showChatSettingsModal();
        });

        micBtn?.addEventListener('click', () => {
            UIManager.showSystemMessageInChat('Voice input is not implemented yet. It\'s on the list!');
        });
        
        // --- Intelligent Suggestions ---
        const handleSuggestions = async () => {
            const text = chatInput.value.trim();
            if (text.length < 4) {
                suggestionsContainer.innerHTML = '';
                return;
            }
            const suggestions = await BackendAPI.chat.suggest(text);
            suggestionsContainer.innerHTML = '';
            suggestions.forEach(suggestion => {
                const btn = document.createElement('button');
                btn.className = 'chat-suggestion-btn';
                btn.textContent = suggestion.label;
                btn.onclick = () => {
                    // Handle different action types
                    if (suggestion.action.type === 'fill_input') {
                        chatInput.value = suggestion.action.text;
                        chatInput.focus();
                    }
                    suggestionsContainer.innerHTML = ''; // Clear after use
                };
                suggestionsContainer.appendChild(btn);
            });
        };

        const debounce = (func, delay) => {
            return (...args) => {
                clearTimeout(this.state.suggestionTimeout);
                this.state.suggestionTimeout = setTimeout(() => func.apply(this, args), delay);
            };
        };
        const debouncedSuggestionHandler = debounce(handleSuggestions, 500);
        
        // --- Chat Message Logic ---
        
        chatInput.addEventListener('input', () => {
            sendButton.disabled = chatInput.value.trim() === '';
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
            debouncedSuggestionHandler();
        });
        
        stopButton.addEventListener('click', () => {
            shouldStopGeneration = true;
        });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = chatInput.value.trim();
            if (!userInput || !BackendAPI.isInitialized) return;

            appendMessage(userInput, 'user');
            
            const activeTemplate = this.state.templates.find(t => t.id === this.state.activeTemplateId);
            
            chatInput.value = '';
            sendButton.disabled = true;
            suggestionsContainer.innerHTML = '';
            shouldStopGeneration = false;
            chatForm.classList.add('is-generating');
            chatInput.style.height = 'auto';

            let firstChunk = true;
            currentAssistantMessageEl = createMessageElement('assistant');
            const assistantP = currentAssistantMessageEl.querySelector('p');
            assistantP.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
            chatLog.prepend(currentAssistantMessageEl);
            
            try {
                await BackendAPI.chat.stream(userInput, this.state.persistentContext, activeTemplate, (chunk) => {
                    if (firstChunk) {
                        assistantP.innerHTML = '';
                        assistantP.textContent = chunk;
                        firstChunk = false;
                    } else {
                        assistantP.textContent += chunk;
                    }
                }, () => shouldStopGeneration);

                if (shouldStopGeneration) {
                    if (firstChunk) {
                        currentAssistantMessageEl.remove();
                    }
                    UIManager.showSystemMessageInChat('Response stopped by user.');
                }
            } catch (error) {
                currentAssistantMessageEl?.remove();
            } finally {
                chatForm.classList.remove('is-generating');
                currentAssistantMessageEl = null;
            }
        });
        
        await renderHistory();
    },

    initializeSettingsModal() {
        const modal = UIManager.elements.chatSettingsModal;
        const overlay = UIManager.elements.chatSettingsModalOverlay;
        const closeBtn = modal.querySelector('#chat-settings-modal-close-btn');
        const clearHistoryBtn = modal.querySelector('#clear-history-btn');
        const downloadDebugBtn = modal.querySelector('#download-debug-btn');
        const addTemplateForm = modal.querySelector('#add-template-form');
        const contextInput = modal.querySelector('#persistent-context-input') as HTMLTextAreaElement;

        closeBtn.addEventListener('click', () => UIManager.hideChatSettingsModal());
        overlay.addEventListener('click', () => UIManager.hideChatSettingsModal());

        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to start a new chat? This will clear the current conversation.')) {
                await BackendAPI.chat.clearHistory();
                const chatLog = document.querySelector('#pane-primary #chat-log, #wallet-container .active #chat-log');
                if (chatLog) chatLog.innerHTML = '<div class="message assistant"><p>Hello! I\'m your live assistant. How can I help you today?</p></div>';
                UIManager.hideChatSettingsModal();
            }
        });

        downloadDebugBtn.addEventListener('click', async () => {
            const history = await BackendAPI.chat.getHistory();
            if (!history || history.length === 0) {
                alert('No history to download.');
                return;
            }
            const formatted = history.map(msg => `[${msg.role.toUpperCase()}]\n${msg.parts.map(p => p.text).join('')}`).join('\n\n---\n\n');
            const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gemini-chat-debug-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UIManager.showSystemMessageInChat('Debug log downloaded.');
        });
        
        addTemplateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = addTemplateForm.querySelector('#new-template-name') as HTMLInputElement;
            const contentInput = addTemplateForm.querySelector('#new-template-content') as HTMLTextAreaElement;
            const name = nameInput.value.trim();
            const content = contentInput.value.trim();
            if (name && content) {
                this.addTemplate(name, content);
                nameInput.value = '';
                contentInput.value = '';
            }
        });

        contextInput.value = this.state.persistentContext;
        contextInput.addEventListener('input', () => {
            this.state.persistentContext = contextInput.value;
            BackendAPI.settings.update({ persistentContext: this.state.persistentContext });
        });

        this.renderTemplates();
    },

    renderTemplates() {
        const listEl = UIManager.elements.chatSettingsModal.querySelector('#format-templates-list');
        listEl.innerHTML = '';
        if (this.state.templates.length === 0) {
            listEl.innerHTML = '<p style="color: var(--secondary-text); font-size: 0.9em;">No templates yet. Add one below.</p>';
        }
        this.state.templates.forEach(template => {
            const btn = document.createElement('button');
            btn.className = 'format-template-btn';
            btn.textContent = template.name;
            btn.dataset.id = template.id;
            if (template.id === this.state.activeTemplateId) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => this.toggleActiveTemplate(template.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-template-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete template "${template.name}"?`)) {
                    this.deleteTemplate(template.id);
                }
            });
            btn.appendChild(deleteBtn);

            listEl.appendChild(btn);
        });
    },

    addTemplate(name, content) {
        const newTemplate = { id: `template-${Date.now()}`, name, content };
        this.state.templates.push(newTemplate);
        BackendAPI.settings.update({ templates: this.state.templates });
        this.renderTemplates();
    },

    deleteTemplate(id) {
        this.state.templates = this.state.templates.filter(t => t.id !== id);
        if (this.state.activeTemplateId === id) {
            this.state.activeTemplateId = null;
        }
        BackendAPI.settings.update({ templates: this.state.templates });
        this.renderTemplates();
    },

    toggleActiveTemplate(id) {
        if (this.state.activeTemplateId === id) {
            this.state.activeTemplateId = null; // Deselect
        } else {
            this.state.activeTemplateId = id; // Select
        }
        this.renderTemplates();
    }
};

/**
 * Logic for the Inbox card.
 * @namespace
 */
const InboxApp = {
    /**
     * @param {HTMLElement} container - The card element.
     */
    async initialize(container) {
        const pasteInput = container.querySelector('#inbox-paste-input') as HTMLTextAreaElement;
        const processBtn = container.querySelector('#inbox-process-btn') as HTMLButtonElement;
        const messageList = container.querySelector('#inbox-message-list');
        
        processBtn.addEventListener('click', async () => {
            const text = pasteInput.value.trim();
            if (text) {
                await BackendAPI.messages.create(text);
                const messages = await BackendAPI.messages.list();
                this.renderMessages(messageList as HTMLElement, messages);
                pasteInput.value = '';
            }
        });
        
        const initialMessages = await BackendAPI.messages.list();
        this.renderMessages(messageList as HTMLElement, initialMessages);
    },
    
    renderMessages(listEl, messages) {
        listEl.innerHTML = '';
        if (messages.length === 0) {
            listEl.innerHTML = '<li class="no-messages">Paste a conversation to get started.</li>';
            return;
        }
        messages.forEach(msg => {
            const item = document.createElement('li');
            item.className = 'inbox-message-item';
            
            const header = document.createElement('div');
            header.className = 'inbox-message-header';

            const text = document.createElement('p');
            text.textContent = msg.text;
            
            const button = document.createElement('button');
            button.className = 'inbox-generate-reply-btn';
            button.textContent = 'Generate Reply';
            button.addEventListener('click', () => this.handleGenerate(msg, item));
            
            header.appendChild(text); // Text is now part of header for layout
            item.appendChild(header);
            item.appendChild(button);
            listEl.appendChild(item);
        });
    },
    
    /**
     * This now calls the backend to generate a reply.
     */
    async handleGenerate(message, listItemEl) {
        const settings = await BackendAPI.settings.get();
        const activeTemplate = settings.templates.find(t => t.id === ChatApp.state.activeTemplateId);

        UIManager.showSystemMessageInChat('Generating reply for inbox message...');
        
        try {
            const data = await BackendAPI._fetch('/generate-reply', {
                method: 'POST',
                body: JSON.stringify({
                    message: message.text,
                    templateId: activeTemplate?.id,
                    context: settings.persistentContext,
                }),
            });

            const aiReply = data.aiResponse;

            // Display emotion tag
            if (data.emotion) {
                listItemEl.dataset.emotion = data.emotion;
                const header = listItemEl.querySelector('.inbox-message-header');
                // Remove old tag if it exists
                header.querySelector('.emotion-tag')?.remove();
                
                const emotionTag = document.createElement('span');
                emotionTag.className = `emotion-tag ${data.emotion}`;
                emotionTag.textContent = data.emotion;
                header.appendChild(emotionTag);
            }

            if (aiReply) {
                UIManager.showConfirmationToast(
                    message.text,
                    aiReply,
                    async () => { // onSend
                        navigator.clipboard.writeText(aiReply).then(() => {
                            UIManager.showSystemMessageInChat('Reply copied to clipboard!');
                        });
                        await BackendAPI.messages.delete(message.id);
                        const listEl = document.querySelector('#card-inbox #inbox-message-list');
                        if (listEl) {
                            const updatedMessages = await BackendAPI.messages.list();
                            this.renderMessages(listEl as HTMLElement, updatedMessages);
                        }
                        UIManager.hideConfirmationToast();
                    },
                    () => { // onCancel
                        UIManager.hideConfirmationToast();
                    }
                );
            } else {
                 UIManager.showSystemMessageInChat('Failed to generate reply.');
            }
        } catch(e) {
             UIManager.showSystemMessageInChat('Error generating reply.');
        }
    }
};


/**
 * Logic for the Tasks card.
 * @namespace
 */
const TasksApp = {
    state: {
        tasks: [],
        isLoading: true,
    },
    elements: {
        container: null as HTMLElement | null,
        list: null as HTMLElement | null,
        form: null as HTMLFormElement | null,
        titleInput: null as HTMLInputElement | null,
        prioritySelect: null as HTMLSelectElement | null,
    },
    /**
     * @param {HTMLElement} container - The card element.
     */
    async initialize(container) {
        this.elements.container = container;
        this.elements.list = container.querySelector('#task-list');
        this.elements.form = container.querySelector('#add-task-form');
        this.elements.titleInput = container.querySelector('#task-title-input');
        this.elements.prioritySelect = container.querySelector('#task-priority-select');
        
        this.elements.form.addEventListener('submit', this.handleAddTask.bind(this));
        
        await this.fetchAndRenderTasks();
    },

    async fetchAndRenderTasks() {
        this.state.isLoading = true;
        this.render();
        try {
            const tasks = await BackendAPI.tasks.list();
            this.state.tasks = tasks.sort((a, b) => Number(a.completed) - Number(b.completed)); // Show incomplete first
        } catch (error) {
            console.error("Failed to fetch tasks", error);
            this.state.tasks = []; // Clear tasks on error
        } finally {
            this.state.isLoading = false;
            this.render();
        }
    },
    
    async handleAddTask(e) {
        e.preventDefault();
        const title = this.elements.titleInput.value.trim();
        const priority = this.elements.prioritySelect.value;
        if (!title) return;

        this.elements.titleInput.disabled = true;
        try {
            await BackendAPI.tasks.create(title, priority);
            this.elements.form.reset();
            await this.fetchAndRenderTasks();
        } finally {
            this.elements.titleInput.disabled = false;
            this.elements.titleInput.focus();
        }
    },

    async handleToggleTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        await BackendAPI.tasks.update(taskId, !task.completed);
        await this.fetchAndRenderTasks();
    },

    async handleDeleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            await BackendAPI.tasks.delete(taskId);
            await this.fetchAndRenderTasks();
        }
    },

    render() {
        if (!this.elements.list) return;
        const listEl = this.elements.list;
        
        if (this.state.isLoading) {
            listEl.innerHTML = '<li class="no-tasks-message">Loading tasks...</li>';
            return;
        }

        if (this.state.tasks.length === 0) {
            listEl.innerHTML = '<li class="no-tasks-message">No tasks yet. Add one below!</li>';
            return;
        }

        listEl.innerHTML = ''; // Clear previous
        this.state.tasks.forEach(task => {
            const item = document.createElement('li');
            item.className = 'task-item';
            item.classList.toggle('completed', task.completed);
            item.dataset.priority = task.priority;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => this.handleToggleTask(task.id));

            const title = document.createElement('span');
            title.className = 'task-title';
            title.textContent = task.title;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-task-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.ariaLabel = `Delete task: ${task.title}`;
            deleteBtn.addEventListener('click', () => this.handleDeleteTask(task.id));

            item.appendChild(checkbox);
            item.appendChild(title);
            item.appendChild(deleteBtn);
            listEl.appendChild(item);
        });
    },
};

/**
 * Logic for the Notes card.
 * @namespace
 */
const NotesApp = {
    state: {
        notes: [],
        isLoading: true,
    },
    elements: {
        list: null as HTMLElement | null,
        form: null as HTMLFormElement | null,
        contentInput: null as HTMLTextAreaElement | null,
    },
    async initialize(container) {
        this.elements.list = container.querySelector('#notes-list');
        this.elements.form = container.querySelector('#add-note-form');
        this.elements.contentInput = container.querySelector('#note-content-input');

        this.elements.form.addEventListener('submit', this.handleAddNote.bind(this));
        await this.fetchAndRenderNotes();
    },
    async fetchAndRenderNotes() {
        this.state.isLoading = true;
        this.render();
        try {
            const notes = await BackendAPI.notes.list();
            this.state.notes = notes.reverse(); // Show newest first
        } catch (error) {
            console.error("Failed to fetch notes", error);
            this.state.notes = [];
        } finally {
            this.state.isLoading = false;
            this.render();
        }
    },
    async handleAddNote(e) {
        e.preventDefault();
        const content = this.elements.contentInput.value.trim();
        if (!content) return;

        this.elements.contentInput.disabled = true;
        try {
            await BackendAPI.notes.create(content);
            this.elements.form.reset();
            await this.fetchAndRenderNotes();
        } finally {
            this.elements.contentInput.disabled = false;
            this.elements.contentInput.focus();
        }
    },
    render() {
        if (!this.elements.list) return;
        const listEl = this.elements.list;

        if (this.state.isLoading) {
            listEl.innerHTML = '<li class="no-messages">Loading notes...</li>';
            return;
        }
        if (this.state.notes.length === 0) {
            listEl.innerHTML = '<li class="no-messages">No notes yet. Add one below.</li>';
            return;
        }

        listEl.innerHTML = '';
        this.state.notes.forEach(note => {
            const item = document.createElement('li');
            item.className = 'note-item';
            item.textContent = note.content;
            listEl.appendChild(item);
        });
    }
};

/**
 * NEW: Logic for the Gadgets card.
 * @namespace
 */
const GadgetsApp = {
    async initialize(container) {
        const contentArea = container.querySelector('#gadgets-content');
        if (!contentArea) return;

        // Fetch all data in parallel
        try {
            const [status, widgets, expenseSummary, activityLog] = await Promise.all([
                BackendAPI.system.getStatus(),
                BackendAPI.widgets.list(),
                BackendAPI.expenses.getSummary(),
                BackendAPI.activityLog.list(),
            ]);
            
            contentArea.innerHTML = ''; // Clear loading message
            
            // Render widgets
            this.renderSystemStatusWidget(contentArea, status);
            this.renderTrafficLightWidget(contentArea, widgets);
            this.renderExpenseChartWidget(contentArea, expenseSummary);
            this.renderActivityLogWidget(contentArea, activityLog);

        } catch (error) {
            console.error("Failed to load gadgets data", error);
            contentArea.innerHTML = '<div class="card-placeholder-content"><p>Failed to load gadgets. The backend might be throwing a tantrum.</p></div>';
        }
    },

    renderSystemStatusWidget(container, status) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        
        const uptime = new Date(status.serverUptime * 1000).toISOString().substr(11, 8);

        widget.innerHTML = `
            <div class="widget-header"><h3 class="widget-title">System Status</h3></div>
            <div class="widget-content">
                <div class="system-status-grid">
                    <div class="status-metric">
                        <div class="status-metric-value">${uptime}</div>
                        <div class="status-metric-label">Uptime</div>
                    </div>
                     <div class="status-metric">
                        <div class="status-metric-value">${status.avgGeminiResponseTime}<small>ms</small></div>
                        <div class="status-metric-label">Avg AI Response</div>
                    </div>
                     <div class="status-metric">
                        <div class="status-metric-value">${status.tasksPending}</div>
                        <div class="status-metric-label">Pending Tasks</div>
                    </div>
                     <div class="status-metric">
                        <div class="status-metric-value">${status.inboxHistoryCount}</div>
                        <div class="status-metric-label">Replies Sent</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(widget);
    },
    
    renderTrafficLightWidget(container, widgets) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `<div class="widget-header"><h3 class="widget-title">System Health</h3></div>
        <div class="widget-content traffic-light-container"></div>`;

        const content = widget.querySelector('.traffic-light-container');
        widgets.forEach(item => {
            if (item.type === 'traffic-light') {
                const lightEl = document.createElement('div');
                lightEl.className = 'traffic-light-item';
                lightEl.innerHTML = `
                    <div class="traffic-light-indicator ${item.status}"></div>
                    <span class="traffic-light-label">${item.label}</span>
                `;
                content.appendChild(lightEl);
            }
        });
        container.appendChild(widget);
    },

    renderExpenseChartWidget(container, summary) {
        if (summary.length === 0) return;
        
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `<div class="widget-header"><h3 class="widget-title">Expense Summary</h3></div>
        <div class="widget-content expense-chart"></div>`;
        
        const content = widget.querySelector('.expense-chart');
        const maxTotal = Math.max(...summary.map(item => item.total));

        summary.forEach(item => {
            const percentage = (item.total / maxTotal) * 100;
            const itemEl = document.createElement('div');
            itemEl.className = 'expense-bar-item';
            itemEl.innerHTML = `
                <span class="expense-bar-label" title="${item.category}">${item.category}</span>
                <div class="expense-bar-container">
                    <div class="expense-bar" style="width: ${percentage}%"></div>
                </div>
                <span class="expense-bar-amount">$${item.total.toLocaleString()}</span>
            `;
            content.appendChild(itemEl);
        });
        container.appendChild(widget);
    },

    renderActivityLogWidget(container, log) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `<div class="widget-header"><h3 class="widget-title">Activity Log</h3></div>
        <div class="widget-content">
            <ul class="activity-log-list"></ul>
        </div>`;
        
        const listEl = widget.querySelector('.activity-log-list');
        if (log.length === 0) {
            listEl.innerHTML = '<li class="no-messages">No recent activity. Too quiet...</li>';
        } else {
            log.slice(0, 10).forEach(entry => { // Show last 10
                 const itemEl = document.createElement('li');
                 itemEl.className = 'activity-log-item';
                 itemEl.innerHTML = `<span class="activity-log-type">${entry.type.replace(/_/g, ' ')}</span>`;
                 listEl.appendChild(itemEl);
            });
        }
        container.appendChild(widget);
    }
};


/**
 * Logic for the Settings card.
 * @namespace
 */
const SettingsApp = {
    async initialize(container) {
        const settings = await BackendAPI.settings.get();
        this.initializeThemeSwitcher(container, settings.theme);
        this.initializeApiKeyManager(container);
    },

    initializeThemeSwitcher(container, currentTheme) {
        const themeButtons = container.querySelectorAll('.theme-btn');

        const applyTheme = (theme) => {
            document.body.dataset.theme = theme;
            themeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
            });
        };

        themeButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const theme = button.getAttribute('data-theme');
                if (theme) {
                    applyTheme(theme);
                    await BackendAPI.settings.update({ theme });
                }
            });
        });

        applyTheme(currentTheme);
    },

    async initializeApiKeyManager(container) {
        const listEl = container.querySelector('#api-keys-list') as HTMLElement;
        const form = container.querySelector('#add-api-key-form') as HTMLFormElement;
        const nameInput = container.querySelector('#api-key-name-input') as HTMLInputElement;
        const valueInput = container.querySelector('#api-key-value-input') as HTMLInputElement;

        const refreshKeys = async () => {
            const keys = await BackendAPI.apiKeys.list();
            this.renderApiKeys(listEl, keys, refreshKeys);
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const value = valueInput.value.trim();
            if (!name || !value) {
                alert("Please provide both a name and a value for the API key.");
                return;
            }

            await BackendAPI.apiKeys.create(name, value);
            form.reset();
            await refreshKeys();
        });

        await refreshKeys(); // Initial render
    },

    renderApiKeys(listEl, apiKeys, refreshCallback) {
        listEl.innerHTML = '';
        if (apiKeys.length === 0) {
            listEl.innerHTML = '<li class="no-messages">No API keys added. Keys are stored in your browser\'s local storage.</li>';
            return;
        }
        apiKeys.forEach(apiKey => {
            const item = document.createElement('li');
            item.className = 'api-key-item';
            
            const nameEl = document.createElement('strong');
            nameEl.textContent = apiKey.name;
            
            const valuePreview = document.createElement('span');
            valuePreview.className = 'api-key-preview';
            valuePreview.textContent = `...${apiKey.value.slice(-4)}`;

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.ariaLabel = `Delete ${apiKey.name} key`;
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete the "${apiKey.name}" key? This cannot be undone.`)) {
                    await BackendAPI.apiKeys.delete(apiKey.id);
                    await refreshCallback();
                }
            });

            item.appendChild(nameEl);
            item.appendChild(valuePreview);
            item.appendChild(deleteBtn);
            listEl.appendChild(item);
        });
    }
};


// --- Global Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    UIManager.initialize();
    BackendAPI.initialize();
});