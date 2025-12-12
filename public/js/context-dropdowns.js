/**
 * Accessible dropdown components for Document and Part Studio selection
 * Based on the PlaneSelector pattern for consistency
 */

export class ContextDropdown {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId,
            buttonId: config.buttonId,
            dropdownId: config.dropdownId,
            defaultText: config.defaultText || 'Select...',
            onSelect: config.onSelect || (() => {}),
            ...config
        };
        
        this.selectedItem = null;
        this.items = [];
        this.initialized = false;
        
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        try {
            this.button = document.getElementById(this.config.buttonId);
            this.dropdownContent = document.getElementById(this.config.dropdownId);
            
            if (!this.button || !this.dropdownContent) {
                throw new Error(`Required elements not found: ${this.config.buttonId}, ${this.config.dropdownId}`);
            }
            
            this._initEventListeners();
            this._initKeyboardNavigation();
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize dropdown:', error);
            throw error;
        }
    }

    setItems(items) {
        this.items = items || [];
        this._renderItems();
    }

    setSelected(item) {
        this.selectedItem = item;
        if (this.button) {
            const buttonText = this.button.querySelector('.dropdown-button-text');
            if (buttonText) {
                buttonText.textContent = item?.name || this.config.defaultText;
            }
        }
    }

    _renderItems() {
        if (!this.dropdownContent) return;
        
        this.dropdownContent.innerHTML = '';
        
        if (this.items.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'dropdown-item dropdown-item-empty';
            emptyItem.textContent = 'No items available';
            emptyItem.setAttribute('tabindex', '-1');
            this.dropdownContent.appendChild(emptyItem);
            return;
        }
        
        this.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            itemElement.textContent = item.name;
            itemElement.dataset.itemId = item.id;
            itemElement.setAttribute('tabindex', '0');
            itemElement.setAttribute('role', 'option');
            
            if (this.selectedItem && this.selectedItem.id === item.id) {
                itemElement.classList.add('dropdown-item-selected');
                itemElement.setAttribute('aria-selected', 'true');
            }
            
            itemElement.addEventListener('click', () => this._handleItemSelected(item));
            this.dropdownContent.appendChild(itemElement);
        });
    }

    _handleItemSelected(item) {
        this.setSelected(item);
        this._closeDropdown();
        if (this.config.onSelect) {
            this.config.onSelect(item);
        }
    }

    _initEventListeners() {
        // Button click handler
        this.button.addEventListener('click', (event) => {
            event.stopPropagation();
            this._toggleDropdown();
        });
        
        // Click outside handler
        document.addEventListener('click', (event) => {
            if (!this.button.contains(event.target) && 
                !this.dropdownContent.contains(event.target)) {
                this._closeDropdown();
            }
        });
    }

    _initKeyboardNavigation() {
        // ARIA attributes
        this.button.setAttribute('aria-haspopup', 'true');
        this.button.setAttribute('aria-expanded', 'false');
        this.dropdownContent.setAttribute('role', 'listbox');
        
        // Button keyboard handler
        this.button.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'Enter':
                case ' ':
                case 'ArrowDown':
                    event.preventDefault();
                    if (!this.dropdownContent.classList.contains('show')) {
                        this._toggleDropdown();
                    }
                    const firstItem = this.dropdownContent.querySelector('.dropdown-item[tabindex="0"]');
                    firstItem?.focus();
                    break;
                case 'Escape':
                    this._closeDropdown();
                    break;
            }
        });
        
        // Dropdown keyboard handler
        this.dropdownContent.addEventListener('keydown', (event) => {
            const items = Array.from(this.dropdownContent.querySelectorAll('.dropdown-item[tabindex="0"]'));
            const currentIndex = items.indexOf(document.activeElement);
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    if (currentIndex < items.length - 1) {
                        items[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (currentIndex > 0) {
                        items[currentIndex - 1].focus();
                    } else {
                        this.button.focus();
                        this._closeDropdown();
                    }
                    break;
                case 'Escape':
                    this._closeDropdown();
                    this.button.focus();
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (document.activeElement.classList.contains('dropdown-item')) {
                        const itemId = document.activeElement.dataset.itemId;
                        const item = this.items.find(i => i.id === itemId);
                        if (item) {
                            this._handleItemSelected(item);
                        }
                    }
                    break;
                case 'Home':
                    event.preventDefault();
                    items[0]?.focus();
                    break;
                case 'End':
                    event.preventDefault();
                    items[items.length - 1]?.focus();
                    break;
            }
        });
    }

    _toggleDropdown() {
        const wasVisible = this.dropdownContent.classList.contains('show');
        this.dropdownContent.classList.toggle('show');
        this.button.setAttribute('aria-expanded', !wasVisible);
    }

    _closeDropdown() {
        this.dropdownContent.classList.remove('show');
        this.button.setAttribute('aria-expanded', 'false');
    }
}

