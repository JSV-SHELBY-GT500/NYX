/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat } from '@google/genai';

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
 * Manages all AI-related interactions with the GoogleGenAI SDK.
 * @namespace
 */
const AIController = {
    /** @type {GoogleGenAI | null} */
    ai: null,
    /** @type {Chat | null} */
    chat: null,
    isInitialized: false,
    chatHistoryKey: 'gemini-chat-history',

    /**
     * Initializes the GoogleGenAI client and the chat session.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const savedHistory = localStorage.getItem(this.chatHistoryKey);
            const history = savedHistory ? JSON.parse(savedHistory) : [];

            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            this.chat = this.ai.chats.create({ model: 'gemini-2.5-flash', history });
            this.isInitialized = true;
            console.log('AI Controller Initialized with history.');
        } catch (error) {
            console.error('Failed to initialize AI session:', error);
            UIManager.showSystemMessageInChat('Could not connect to the assistant. Please check your API key and refresh the page.');
            // Disable inputs globally
            document.querySelectorAll('input, button').forEach(el => (el as HTMLInputElement).disabled = true);
        }
    },

    /**
     * Sends a message to the chat and streams the response.
     * @param {string} userInput - The user's message.
     * @param {(chunk: string) => void} onChunk - Callback for each response chunk.
     * @param {() => boolean} shouldStop - Function to check if generation should stop.
     * @returns {Promise<void>}
     */
    async streamChatMessage(userInput, onChunk, shouldStop) {
        if (!this.chat) return;
        try {
            // Per request, send the last 5 messages as context.
            // The `sendMessageStream` function uses the `chat.history` array for context.
            // We truncate it here to limit the context window.
            const historyLimit = 5;
            if (this.chat.history.length > historyLimit) {
                this.chat.history = this.chat.history.slice(this.chat.history.length - historyLimit);
            }

            const result = await this.chat.sendMessageStream({ message: userInput });
            for await (const chunk of result) {
                if (shouldStop()) break;
                onChunk(chunk.text);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            UIManager.showSystemMessageInChat('Failed to send message. Please try again.');
            throw error; // Re-throw to allow caller to handle UI state
        }
    },
    
    /**
     * Saves the current chat history to localStorage.
     */
    saveChatHistory() {
        if (this.chat) {
            localStorage.setItem(this.chatHistoryKey, JSON.stringify(this.chat.history));
        }
    },

    /**
     * Clears the chat history from the session and localStorage.
     */
    clearChatHistory() {
        if (this.chat) {
            this.chat.history = [];
        }
        localStorage.removeItem(this.chatHistoryKey);
        console.log('Chat history cleared.');
    },

    /**
     * Performs a one-off content generation for quick access.
     * @param {string} userInput - The user's prompt.
     * @returns {Promise<string | null>} The model's response text.
     */
    async quickQuery(userInput) {
        if (!this.ai) return null;
        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: userInput,
            });
            return response.text;
        } catch (error) {
            console.error('Quick access query failed:', error);
            return 'Sorry, something went wrong.';
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
                this.openCard(cardId, 'primary', { isBackNavigation: false });
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
            case 'card-home':
                HomeApp.initialize(cardEl);
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
            chatLog.appendChild(messageEl);
            chatLog.scrollTop = chatLog.scrollHeight;
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
        let quickAccessConversation = null;

        quickAccessForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = quickAccessInput.value.trim();
            if (!userInput || !AIController.isInitialized) return;
            
            quickAccessInput.disabled = true;
            quickAccessText.textContent = 'Thinking...';
            quickAccessResponse.classList.add('active');
            
            const modelResponse = await AIController.quickQuery(userInput);
            
            quickAccessText.textContent = modelResponse;
            quickAccessConversation = { userInput, modelResponse };
            quickAccessForm.style.display = 'none';
            quickAccessInput.disabled = false;
            quickAccessInput.value = '';
        });

        goToChatBtn?.addEventListener('click', () => {
             // We need to pass the conversation to the chat app somehow if it opens
             // This is a more advanced state management problem. For now, just open chat.
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
    },
    keys: {
        templates: 'chat-format-templates',
        context: 'chat-persistent-context',
    },

    /**
     * @param {HTMLElement} container - The card element.
     */
    initialize(container) {
        const chatLog = container.querySelector('#chat-log');
        const chatForm = container.querySelector('#chat-form');
        const chatInput = container.querySelector('#chat-input') as HTMLTextAreaElement;
        const sendButton = container.querySelector('#send-btn') as HTMLButtonElement;
        const stopButton = container.querySelector('#stop-btn') as HTMLButtonElement;
        const settingsBtn = container.querySelector('#chat-settings-btn') as HTMLButtonElement;
        
        if (!chatLog || !chatForm || !chatInput || !sendButton || !stopButton || !settingsBtn) return;
        
        let currentAssistantMessageEl = null;
        let shouldStopGeneration = false;
        
        this.loadState();
        this.initializeSettingsModal();
        
        // --- Message Rendering Logic ---
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
            chatLog.appendChild(messageEl);
            chatLog.scrollTop = chatLog.scrollHeight;
        };

        // --- History & Menu Setup ---
        const renderHistory = () => {
            chatLog.innerHTML = '';
            if (!AIController.chat || AIController.chat.history.length === 0) {
                 appendMessage("Hello! I'm your live assistant. How can I help you today?", 'assistant');
                 return;
            }

            AIController.chat.history.forEach(msg => {
                const sender = msg.role === 'user' ? 'user' : 'assistant';
                // The history parts can be multiple, join them.
                const text = msg.parts.map(part => part.text).join('');
                appendMessage(text, sender);
            });
        };

        // --- Settings Menu Logic ---
        const gearIcon = document.getElementById('settings-gear-icon')?.cloneNode(true);
        if (gearIcon && !settingsBtn.querySelector('svg')) {
             settingsBtn.appendChild(gearIcon);
        }

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            UIManager.showChatSettingsModal();
        });
        
        // --- Chat Message Logic ---
        
        chatInput.addEventListener('input', () => {
            sendButton.disabled = chatInput.value.trim() === '';
             // Auto-resize textarea
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
        });
        
        stopButton.addEventListener('click', () => {
            shouldStopGeneration = true;
        });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = chatInput.value.trim();
            if (!userInput || !AIController.isInitialized) return;

            appendMessage(userInput, 'user');
            
            let finalUserInput = userInput;
            if (this.state.persistentContext) {
                finalUserInput = `CONTEXT: "${this.state.persistentContext}"\n\n${finalUserInput}`;
            }
            const activeTemplate = this.state.templates.find(t => t.id === this.state.activeTemplateId);
            if (activeTemplate) {
                 finalUserInput = `TEMPLATE: "${activeTemplate.content}"\n\n${finalUserInput}`;
            }
            
            chatInput.value = '';
            sendButton.disabled = true;
            shouldStopGeneration = false;
            chatForm.classList.add('is-generating');

            // Reset textarea height after sending
            chatInput.style.height = 'auto';

            let firstChunk = true;
            currentAssistantMessageEl = createMessageElement('assistant');
            const assistantP = currentAssistantMessageEl.querySelector('p');
            // Add typing indicator
            assistantP.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
            chatLog.appendChild(currentAssistantMessageEl);
            chatLog.scrollTop = chatLog.scrollHeight;
            
            try {
                await AIController.streamChatMessage(finalUserInput, (chunk) => {
                    if (firstChunk) {
                        assistantP.innerHTML = ''; // Clear indicator
                        assistantP.textContent = chunk;
                        firstChunk = false;
                    } else {
                        assistantP.textContent += chunk;
                    }
                    chatLog.scrollTop = chatLog.scrollHeight;
                }, () => shouldStopGeneration);

                if (shouldStopGeneration) {
                    if (firstChunk) { // Stopped before any content arrived
                        currentAssistantMessageEl.remove();
                    }
                    UIManager.showSystemMessageInChat('Response stopped by user.');
                } else {
                    // Save history on successful completion
                    AIController.saveChatHistory();
                }
            } catch (error) {
                // Error occurred, remove the indicator bubble
                currentAssistantMessageEl?.remove();
            } finally {
                chatForm.classList.remove('is-generating');
                currentAssistantMessageEl = null;
            }
        });

        // Initial render of history
        renderHistory();
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

        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to start a new chat? This will clear the current conversation.')) {
                AIController.clearChatHistory();
                const chatLog = document.querySelector('#pane-primary #chat-log, #wallet-container .active #chat-log');
                if (chatLog) chatLog.innerHTML = '<div class="message assistant"><p>Hello! I\'m your live assistant. How can I help you today?</p></div>';
                UIManager.hideChatSettingsModal();
            }
        });

        downloadDebugBtn.addEventListener('click', () => {
            const history = AIController.chat?.history.slice(-10) || [];
            if (history.length === 0) {
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
            this.saveState();
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
        this.saveState();
        this.renderTemplates();
    },

    deleteTemplate(id) {
        this.state.templates = this.state.templates.filter(t => t.id !== id);
        if (this.state.activeTemplateId === id) {
            this.state.activeTemplateId = null;
        }
        this.saveState();
        this.renderTemplates();
    },

    toggleActiveTemplate(id) {
        if (this.state.activeTemplateId === id) {
            this.state.activeTemplateId = null; // Deselect
        } else {
            this.state.activeTemplateId = id; // Select
        }
        this.saveState();
        this.renderTemplates();
    },
    
    saveState() {
        localStorage.setItem(this.keys.templates, JSON.stringify(this.state.templates));
        localStorage.setItem(this.keys.context, this.state.persistentContext);
    },

    loadState() {
        const savedTemplates = localStorage.getItem(this.keys.templates);
        const savedContext = localStorage.getItem(this.keys.context);
        this.state.templates = savedTemplates ? JSON.parse(savedTemplates) : [];
        this.state.persistentContext = savedContext || '';
    }
};

/**
 * Logic for the Inbox card.
 * @namespace
 */
const InboxApp = {
    /** @type {{id: number, text: string}[]} */
    messages: [],

    initialize(container) {
        const pasteInput = container.querySelector('#inbox-paste-input') as HTMLTextAreaElement;
        const processBtn = container.querySelector('#inbox-process-btn') as HTMLButtonElement;
        const messageList = container.querySelector('#inbox-message-list');
        
        processBtn.addEventListener('click', () => {
            const text = pasteInput.value.trim();
            if (text) {
                this.messages.push({ id: Date.now(), text });
                this.renderMessages(messageList);
                pasteInput.value = '';
            }
        });
        
        this.renderMessages(messageList);
    },
    
    renderMessages(listEl) {
        listEl.innerHTML = '';
        if (this.messages.length === 0) {
            listEl.innerHTML = '<li class="no-messages">Paste a conversation to get started.</li>';
            return;
        }
        this.messages.forEach(msg => {
            const item = document.createElement('li');
            item.className = 'inbox-message-item';
            
            const text = document.createElement('p');
            text.textContent = msg.text;
            
            const button = document.createElement('button');
            button.className = 'inbox-generate-reply-btn';
            button.textContent = 'Generate Reply';
            button.addEventListener('click', () => this.handleGenerate(msg));
            
            item.appendChild(text);
            item.appendChild(button);
            listEl.appendChild(item);
        });
    },
    
    async handleGenerate(message) {
        const activeTemplate = ChatApp.state.templates.find(t => t.id === ChatApp.state.activeTemplateId);
        if (!activeTemplate) {
            alert('Please select a format template from the Chat settings first.');
            return;
        }

        UIManager.showSystemMessageInChat('Generating reply for inbox message...');
        let prompt = `Using the template "${activeTemplate.name}", generate a reply for the following customer message.\n\nTEMPLATE INSTRUCTIONS:\n${activeTemplate.content}\n\nCUSTOMER MESSAGE:\n${message.text}`;
        
        if (ChatApp.state.persistentContext) {
            prompt = `GENERAL CONTEXT:\n${ChatApp.state.persistentContext}\n\n${prompt}`;
        }
        
        const aiReply = await AIController.quickQuery(prompt);
        if (aiReply) {
            UIManager.showConfirmationToast(
                message.text,
                aiReply,
                () => { // onSend
                    navigator.clipboard.writeText(aiReply).then(() => {
                        UIManager.showSystemMessageInChat('Reply copied to clipboard!');
                    });
                    this.messages = this.messages.filter(m => m.id !== message.id);
                    const listEl = document.querySelector('#card-inbox #inbox-message-list');
                    if (listEl) this.renderMessages(listEl as HTMLElement);
                    UIManager.hideConfirmationToast();
                },
                () => { // onCancel
                    UIManager.hideConfirmationToast();
                }
            );
        } else {
             UIManager.showSystemMessageInChat('Failed to generate reply.');
        }
    }
};


// FIX: Added placeholder TasksApp object to resolve reference error.
/**
 * Logic for the Tasks card.
 * @namespace
 */
const TasksApp = {
    /**
     * @param {HTMLElement} container - The card element.
     */
    initialize(container) {
        // This is a placeholder to fix the reference error.
    }
};


/**
 * Logic for the Settings card.
 * @namespace
 */
const SettingsApp = {
    state: {
        settings: { theme: 'dark' },
        apiKeys: [],
    },
    keys: {
        settings: 'assistant-settings',
        apiKeys: 'assistant-api-keys',
    },

    initialize(container) {
        this.loadState();

        this.initializeThemeSwitcher(container);
        this.initializeApiKeyManager(container);
    },

    saveState() {
        localStorage.setItem(this.keys.settings, JSON.stringify(this.state.settings));
        localStorage.setItem(this.keys.apiKeys, JSON.stringify(this.state.apiKeys));
    },

    loadState() {
        const savedSettings = localStorage.getItem(this.keys.settings);
        const savedApiKeys = localStorage.getItem(this.keys.apiKeys);

        if (savedSettings) {
            this.state.settings = JSON.parse(savedSettings);
        }
        if (savedApiKeys) {
            this.state.apiKeys = JSON.parse(savedApiKeys);
        }
    },

    initializeThemeSwitcher(container) {
        const themeButtons = container.querySelectorAll('.theme-btn');

        const applyTheme = (theme) => {
            document.body.dataset.theme = theme;
            themeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
            });
        };

        themeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const theme = button.getAttribute('data-theme');
                if (theme) {
                    this.state.settings.theme = theme;
                    applyTheme(theme);
                    this.saveState();
                }
            });
        });

        applyTheme(this.state.settings.theme || 'dark');
    },

    initializeApiKeyManager(container) {
        const listEl = container.querySelector('#api-keys-list');
        const form = container.querySelector('#add-api-key-form');
        const nameInput = container.querySelector('#api-key-name-input') as HTMLInputElement;
        const valueInput = container.querySelector('#api-key-value-input') as HTMLInputElement;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const value = valueInput.value.trim();
            if (name && value) {
                this.addApiKey(name, value);
                nameInput.value = '';
                valueInput.value = '';
            }
        });

        this.renderApiKeys(listEl);
    },

    renderApiKeys(listEl) {
        listEl.innerHTML = '';
        if (this.state.apiKeys.length === 0) {
            listEl.innerHTML = '<li class="no-messages">No API keys added.</li>';
            return;
        }
        this.state.apiKeys.forEach(apiKey => {
            const item = document.createElement('li');
            item.className = 'api-key-item';
            
            const nameEl = document.createElement('strong');
            nameEl.textContent = apiKey.name;
            
            const valueEl = document.createElement('span');
            // Show only a portion of the key for display purposes
            valueEl.textContent = `${apiKey.value.substring(0, 4)}...${apiKey.value.slice(-4)}`;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.ariaLabel = `Delete ${apiKey.name} key`;
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete the API key for "${apiKey.name}"?`)) {
                    this.deleteApiKey(apiKey.id);
                }
            });

            const leftContainer = document.createElement('div');
            leftContainer.style.display = 'flex';
            leftContainer.style.flexDirection = 'column';
            leftContainer.appendChild(nameEl);
            leftContainer.appendChild(valueEl);

            item.appendChild(leftContainer);
            item.appendChild(deleteBtn);
            listEl.appendChild(item);
        });
    },

    addApiKey(name, value) {
        const newKey = { id: `key-${Date.now()}`, name, value };
        this.state.apiKeys.push(newKey);
        this.saveState();
        this.renderApiKeys(document.querySelector('#card-settings #api-keys-list'));
    },

    deleteApiKey(id) {
        this.state.apiKeys = this.state.apiKeys.filter(key => key.id !== id);
        this.saveState();
        this.renderApiKeys(document.querySelector('#card-settings #api-keys-list'));
    }
};


// --- Global Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    UIManager.initialize();
    AIController.initialize();
});