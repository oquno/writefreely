(function() {
    'use strict';

    let currentPage = 1;
    let query = "";
    let loading = false;
    let embedFormat = localStorage.getItem('flickrEmbedFormat') || 'Markdown';
    let imageSize = localStorage.getItem('flickrImageSize') || 'b';
    let userId = localStorage.getItem('flickrUserId') || ''; // User ID
    let userName = userId; // Use User ID as userName by default
    let searchWindow = null; // Track the search window instance

    const sizeOptions = {
        's': 'Small (75x75)',
        'q': 'Medium (150x150)',
        'm': 'Normal (240x240)',
        'z': 'Medium Large (640x640)',
        'c': 'Large (800x800)',
        'b': 'Extra Large (1024x1024)',
        'h': 'Extra Large (1600x1600)',
        'k': 'Super Large (2048x2048)'
    };

    function closeSearchWindow() {
        document.body.removeChild(searchWindow);
        searchWindow = null;
        currentPage = 1; // Reset currentPage when window is closed
	query = "";
    }

    // Create input fields for Flickr API key and User ID
    function createSettingsUI() {
        const settingsDiv = document.createElement('div');
        Object.assign(settingsDiv.style, {
            position: 'fixed',
            top: '20px',
            left: '20px',
            width: '300px',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            zIndex: '10000'
        });

        const title = document.createElement('h3');
        title.textContent = 'Flickr API Settings';
        settingsDiv.appendChild(title);

        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.textContent = 'Flickr API Key:';
        settingsDiv.appendChild(apiKeyLabel);

        const apiKeyInput = document.createElement('input');
        Object.assign(apiKeyInput, {
            type: 'text',
            value: localStorage.getItem('flickrApiKey') || ''
        });
        Object.assign(apiKeyInput.style, {
            width: '100%',
            marginBottom: '10px'
        });
        apiKeyInput.addEventListener('input', () => {
            localStorage.setItem('flickrApiKey', apiKeyInput.value);
        });
        settingsDiv.appendChild(apiKeyInput);

        const userIdLabel = document.createElement('label');
        userIdLabel.textContent = 'Flickr User ID:';
        settingsDiv.appendChild(userIdLabel);

        const userIdInput = document.createElement('input');
        Object.assign(userIdInput, {
            type: 'text',
            value: localStorage.getItem('flickrUserId') || ''
        });
        Object.assign(userIdInput.style, {
            width: '100%',
            marginBottom: '10px'
        });
        userIdInput.addEventListener('input', () => {
            localStorage.setItem('flickrUserId', userIdInput.value);
            userId = userIdInput.value;
            userName = userId; // Update userName as well
        });
        settingsDiv.appendChild(userIdInput);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        Object.assign(closeButton.style, {
            marginTop: '10px',
            padding: '5px',
            backgroundColor: '#0073e6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
        });
        closeButton.addEventListener('click', () => document.body.removeChild(settingsDiv));
        settingsDiv.appendChild(closeButton);

        document.body.appendChild(settingsDiv);
    }

    function addFlickrButtonToTextArea(textArea) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        textArea.parentNode.insertBefore(wrapper, textArea);
        wrapper.appendChild(textArea);

        const button = document.createElement('button');
        button.textContent = '🔍 Flickr Image';
        Object.assign(button.style, {
            position: 'fixed',
            top: localStorage.getItem('flickrButtonTop') || '5px',
            left: localStorage.getItem('flickrButtonLeft') || '5px',
            padding: '5px 10px',
            fontSize: '12px',
            zIndex: '1000',
            backgroundColor: '#0073e6',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            userSelect: 'none'
        });

        document.body.appendChild(button);

        let isDragging = false;
        let offsetX, offsetY;

        button.addEventListener('mousedown', (event) => {
            isDragging = true;
            offsetX = event.clientX - button.getBoundingClientRect().left;
            offsetY = event.clientY - button.getBoundingClientRect().top;
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;
            if (searchWindow) {
                closeSearchWindow();
            }
            let newLeft = event.clientX - offsetX;
            let newTop = event.clientY - offsetY;

            // Ensure the button stays within the viewport bounds
            newLeft = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, newTop));

            button.style.left = `${newLeft}px`;
            button.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                localStorage.setItem('flickrButtonLeft', button.style.left);
                localStorage.setItem('flickrButtonTop', button.style.top);
            }
            isDragging = false;
        });

        // タッチデバイス用イベント
        button.addEventListener('touchstart', (event) => {
            isDragging = false;
            tapTimeout = setTimeout(() => {
                isDragging = true;
            }, 200); // 200msの間を判定        
            const touch = event.touches[0];
            offsetX = touch.clientX - button.getBoundingClientRect().left;
            offsetY = touch.clientY - button.getBoundingClientRect().top;
            event.preventDefault();
        });

        document.addEventListener('touchmove', (event) => {
            if (!isDragging) return;
            if (searchWindow) {
                closeSearchWindow();
            }
            const touch = event.touches[0];
            let newLeft = touch.clientX - offsetX;
            let newTop = touch.clientY - offsetY;

            newLeft = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, newTop));

            button.style.left = `${newLeft}px`;
            button.style.top = `${newTop}px`;
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                localStorage.setItem('flickrButtonLeft', button.style.left);
                localStorage.setItem('flickrButtonTop', button.style.top);
            }
            isDragging = false;
        });

        button.addEventListener('click', (event) => {
            if (searchWindow) {
                closeSearchWindow();
            }
            else if (!isDragging) {
                openSearchWindow(textArea);
            }
        });
    }

    async function openSearchWindow(textArea) {
        // Prevent multiple search windows from opening
        if (searchWindow) return;

        const apiKey = localStorage.getItem('flickrApiKey');
        if (!apiKey) {
            createSettingsUI();
            return;
        }

        searchWindow = document.createElement('div');
        Object.assign(searchWindow.style, {
            position: 'fixed',
            top: `${parseInt(localStorage.getItem('flickrButtonTop')) + 50 || 70}px`,
            left: `${parseInt(localStorage.getItem('flickrButtonLeft')) || 5}px`,
            width: '350px',
            height: '550px',
            overflow: 'hidden',
            border: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            padding: '10px',
            zIndex: '10000'
        });

        const titleElement = document.createElement('h3');
        titleElement.textContent = 'Flickr Image Search';
        searchWindow.appendChild(titleElement);

        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        Object.assign(closeButton.style, {
            float: 'right',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '16px'
        });
        closeButton.addEventListener('click', () => {
            document.body.removeChild(searchWindow);
            searchWindow = null;
        });
        searchWindow.appendChild(closeButton);

        const formatSelect = document.createElement('select');
        const formats = ['URL', 'Markdown', 'HTML Embed'];
        formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format;
            if (format === embedFormat) option.selected = true;
            formatSelect.appendChild(option);
        });

        Object.assign(formatSelect.style, {
            marginBottom: '10px'
        });
        formatSelect.addEventListener('change', () => {
            embedFormat = formatSelect.value;
            localStorage.setItem('flickrEmbedFormat', embedFormat);
        });
        searchWindow.appendChild(formatSelect);

        const sizeSelect = document.createElement('select');
        Object.entries(sizeOptions).forEach(([key, label]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = label;
            if (key === imageSize) option.selected = true;
            sizeSelect.appendChild(option);
        });

        Object.assign(sizeSelect.style, {
            marginBottom: '10px'
        });
        sizeSelect.addEventListener('change', () => {
            imageSize = sizeSelect.value;
            localStorage.setItem('flickrImageSize', imageSize);
        });
        searchWindow.appendChild(sizeSelect);

        const form = document.createElement('form');
        Object.assign(form.style, {
            marginBottom: '10px'
        });
        searchWindow.appendChild(form);

        const input = document.createElement('input');
        Object.assign(input, {
            type: 'text',
            placeholder: 'Enter keywords'
        });
        Object.assign(input.style, {
            width: '65%',
            marginRight: '5px'
        });
        form.appendChild(input);

        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        Object.assign(searchButton.style, {
            padding: '5px',
            backgroundColor: '#0073e6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
        });
        form.appendChild(searchButton);

        const resultContainer = document.createElement('div');
        Object.assign(resultContainer.style, {
            overflowY: 'auto',
            height: '380px'
        });
        searchWindow.appendChild(resultContainer);

        document.body.appendChild(searchWindow);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            resultContainer.innerHTML = '';
            currentPage = 1;
            query = input.value;
            titleElement.textContent = query === '' ? 'Your Recent Photos' : `Search Results for "${query}"`;
            searchFlickrImages(query, resultContainer, textArea, userId);
        });

        resultContainer.addEventListener('scroll', () => {
            if (!loading && resultContainer.scrollTop + resultContainer.clientHeight >= resultContainer.scrollHeight - 10) {
                currentPage++;
                searchFlickrImages(query, resultContainer, textArea, userId);
            }
        });

        // Initial load of user's recent photos
        searchFlickrImages('', resultContainer, textArea, userId);
    }

    function searchFlickrImages(query, resultContainer, textArea, user_id = '') {
        const apiKey = localStorage.getItem('flickrApiKey');
        if (!apiKey) return alert('API key is not set.');

        loading = true;
        const url = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&user_id=${user_id}&text=${encodeURIComponent(query)}&sort=date-posted-desc&page=${currentPage}&per_page=20&format=json&nojsoncallback=1`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                showImageResults(data.photos.photo, resultContainer, textArea);
                loading = false;
            })
            .catch(error => {
                console.error('Flickr API Error:', error);
                loading = false;
            });
    }

    function showImageResults(photos, resultContainer, textArea) { 
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.src = `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_q.jpg`;

            // スタイルの設定
            Object.assign(img.style, {
                cursor: 'pointer',
                margin: '1px',
                width: '80px',
                height: '80px'
            });
            img.title = `Click to insert the image titled: "${photo.title || 'Flickr Image'}"`; // Add tooltip with image title

            // マウスオーバーでプレビューを表示する処理の追加
            let hoverTimeout;
            img.addEventListener('mouseenter', () => {
                hoverTimeout = setTimeout(() => {
                    // ツールチップ要素を作成
                    const tooltip = document.createElement('div');
                    tooltip.className = 'flickr-tooltip';

                    // 大きめのプレビュー画像をツールチップに追加
                    const previewImg = document.createElement('img');
                    previewImg.src = `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_z.jpg`; // 大きめの画像を使用
                    tooltip.appendChild(previewImg);

                    // サムネイルの位置にツールチップを表示
                    Object.assign(tooltip.style, {
                        position: 'absolute',
                        zIndex: '10005',
                        left: `${img.getBoundingClientRect().left + 100}px`,
                        top: `${img.getBoundingClientRect().top - 220}px`,
                    });
                    document.body.appendChild(tooltip);
                }, 100); // 1秒待機
            });

            // マウスアウトでツールチップを削除
            img.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                const tooltip = document.querySelector('.flickr-tooltip');
                if (tooltip) tooltip.remove();
            });

            // クリックイベントリスナーで画像を挿入
            img.addEventListener('click', () => {
                insertImageWithFormat(photo, textArea);
            });

            resultContainer.appendChild(img);
        });
    }

    function insertImageWithFormat(photo, textArea) {
        const imageUrl = `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${imageSize}.jpg`;
        const photoPageUrl = `https://www.flickr.com/photos/${userName}/${photo.id}`;
        const imageTitle = photo.title ? photo.title : 'Flickr Image';

        let imageCode = '';
        switch (embedFormat) {
            case 'URL':
                imageCode = photoPageUrl;
                break;
            case 'Markdown':
                imageCode = `[![${imageTitle}](${imageUrl})](${photoPageUrl})`;
                break;
            case 'HTML Embed':
                imageCode = `<a href="${photoPageUrl}" title="${imageTitle}" target="_blank"><img src="${imageUrl}" alt="${imageTitle}" title="${imageTitle}"></a>`;
                break;
            default:
                return;
        }

        // Insert at the cursor position in the textarea
        const startPos = textArea.selectionStart;
        const endPos = textArea.selectionEnd;
        textArea.value = textArea.value.substring(0, startPos) + imageCode + textArea.value.substring(endPos);
        textArea.setSelectionRange(startPos + imageCode.length, startPos + imageCode.length);
        textArea.focus();
    }

    document.querySelectorAll('textarea').forEach(addFlickrButtonToTextArea);
})();
