(function() {
    'use strict';

    // YouTube Data APIを使用する設定
    let apiKey = localStorage.getItem('youtubeEmbedApiKey') || ''; // APIキーはlocalStorageから取得
    let channelId = localStorage.getItem('youtubeChannelId') || ''; // チャンネルIDもlocalStorageから取得

    let currentPage = 1;
    let currentPageToken = null;
    let loading = false;
    let embedFormat = 'HTML Embed';
    let searchWindow = null; // 検索ウィンドウインスタンス

    function closeSearchWindow() {
        if (searchWindow) {
            document.body.removeChild(searchWindow);
            searchWindow = null;
        }
        currentPageToken = null; // ウィンドウが閉じられたときにcurrentPageをリセット
    }

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
        title.textContent = 'YouTube API Settings';
        settingsDiv.appendChild(title);

        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.textContent = 'YouTube API Key:';
        settingsDiv.appendChild(apiKeyLabel);

        const apiKeyInput = document.createElement('input');
        Object.assign(apiKeyInput, {
            type: 'text',
            value: localStorage.getItem('youtubeEmbedApiKey') || ''
        });
        Object.assign(apiKeyInput.style, {
            width: '100%',
            marginBottom: '10px'
        });
        apiKeyInput.addEventListener('input', () => {
            localStorage.setItem('youtubeEmbedApiKey', apiKeyInput.value);
            apiKey = apiKeyInput.value;
        });
        settingsDiv.appendChild(apiKeyInput);

        const channelIdLabel = document.createElement('label');
        channelIdLabel.textContent = 'YouTube Channel ID:';
        settingsDiv.appendChild(channelIdLabel);

        const channelIdInput = document.createElement('input');
        Object.assign(channelIdInput, {
            type: 'text',
            value: localStorage.getItem('youtubeChannelId') || ''
        });
        Object.assign(channelIdInput.style, {
            width: '100%',
            marginBottom: '10px'
        });
        channelIdInput.addEventListener('input', () => {
            localStorage.setItem('youtubeChannelId', channelIdInput.value);
            channelId = channelIdInput.value;
        });
        settingsDiv.appendChild(channelIdInput);

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

    function createSearchUI() {
        searchWindow = document.createElement('div');
        Object.assign(searchWindow.style, {
            position: 'fixed',
            top: `${parseInt(localStorage.getItem('youtubeEmbedButtonTop')) + 25 || 50}px`,
            left: `${parseInt(localStorage.getItem('youtubeEmbedButtonLeft')) || 25}px`,
            width: '400px',
            height: '600px',
            overflow: 'hidden',
            border: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            padding: '10px',
            zIndex: '10000'
        });

        const titleElement = document.createElement('h3');
        titleElement.textContent = 'YouTube Videos';
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
        closeButton.addEventListener('click', closeSearchWindow);
        searchWindow.appendChild(closeButton);

        const form = document.createElement('form');
        Object.assign(form.style, {
            marginBottom: '10px'
        });
        searchWindow.appendChild(form);

        const input = document.createElement('input');
        Object.assign(input, {
            type: 'text',
            placeholder: 'Enter keywords (or leave blank for channel videos)'
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
            height: '500px'
        });
        searchWindow.appendChild(resultContainer);

        document.body.appendChild(searchWindow);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!apiKey) {
                alert('API key is required to search YouTube videos.');
                createSettingsUI();
                return;
            }
            resultContainer.innerHTML = '';
            currentPageToken = null;
            const query = input.value.trim();
            if (query) {
                titleElement.textContent = `Search Results for "${query}"`;
                searchYouTube(query, resultContainer);
            } else {
                titleElement.textContent = 'Channel Videos';
                loadChannelVideos(resultContainer);
            }
        });

        resultContainer.addEventListener('scroll', () => {
            if (!loading && resultContainer.scrollTop + resultContainer.clientHeight >= resultContainer.scrollHeight - 10) {
                loading = true;
                const query = input.value.trim();
                if (query) {
                    searchYouTube(query, resultContainer);
                } else {
                    loadChannelVideos(resultContainer);
                }
            }
        });

        if (!apiKey || !channelId) {
            alert('API key and Channel ID are required to fetch channel videos.');
            createSettingsUI();
            return;
        }
        loadChannelVideos(resultContainer);
    }

    function searchYouTube(query, resultContainer) {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}`;
        if (currentPageToken) {
            url += `&pageToken=${currentPageToken}`;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.items) {
                    showVideoResults(data.items, resultContainer);
                    currentPageToken = data.nextPageToken || null;
                }
                loading = false;
            })
            .catch(error => {
                console.error('YouTube API Error:', error);
                loading = false;
            });
    }

    function loadChannelVideos(resultContainer) {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&key=${apiKey}`;
        if (currentPageToken) {
            url += `&pageToken=${currentPageToken}`;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.items) {
                    showVideoResults(data.items, resultContainer);
                    currentPageToken = data.nextPageToken || null;
                }
                loading = false;
            })
            .catch(error => {
                console.error('YouTube API Error:', error);
                loading = false;
            });
    }

    function showVideoResults(videos, resultContainer) {
        videos.forEach(video => {
            const videoElement = document.createElement('div');
            Object.assign(videoElement.style, {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
                cursor: 'pointer'
            });
            
            const thumbnail = document.createElement('img');
            thumbnail.src = video.snippet.thumbnails.default.url;
            thumbnail.style.marginRight = '10px';
            videoElement.appendChild(thumbnail);

            const title = document.createElement('span');
            title.textContent = video.snippet.title;
            videoElement.appendChild(title);

            videoElement.addEventListener('click', () => {
                insertEmbedCode(video.id.videoId);
            });

            resultContainer.appendChild(videoElement);
        });
    }

    function insertEmbedCode(videoId) {
        const embedCode = `
<div style="position:relative;height:0;padding-bottom:56.25%">
<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" style="position:absolute;width:100%;height:100%;left:0" allowfullscreen></iframe>
</div>`;

        const textArea = document.querySelector('textarea');
        if (textArea) {
            const startPos = textArea.selectionStart;
            const endPos = textArea.selectionEnd;
            textArea.value = textArea.value.substring(0, startPos) + embedCode + textArea.value.substring(endPos);
            textArea.setSelectionRange(startPos + embedCode.length, startPos + embedCode.length);
            textArea.focus();
        }
        closeSearchWindow();
    }

    function addYouTubeButtonToTextArea(textArea) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        textArea.parentNode.insertBefore(wrapper, textArea);
        wrapper.appendChild(textArea);

        const button = document.createElement('button');
        button.textContent = '🔍 YouTube Videos';
        Object.assign(button.style, {
            position: 'fixed',
            top: localStorage.getItem('youtubeEmbedButtonTop') || '5px',
            left: localStorage.getItem('youtubeEmbedButtonLeft') || '5px',
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
            let newLeft = event.clientX - offsetX;
            let newTop = event.clientY - offsetY;

            newLeft = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, newTop));

            button.style.left = `${newLeft}px`;
            button.style.top = `${newTop}px`;
            if (searchWindow) {
                searchWindow.style.left = `${newLeft + 20}px`;
                searchWindow.style.top = `${newTop + 20}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                localStorage.setItem('youtubeEmbedButtonLeft', button.style.left);
                localStorage.setItem('youtubeEmbedButtonTop', button.style.top);
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
                localStorage.setItem('youtubeEmbedButtonLeft', button.style.left);
                localStorage.setItem('youtubeEmbedButtonTop', button.style.top);
            }
            isDragging = false;
        });

        button.addEventListener('click', () => {
            if (searchWindow) {
                closeSearchWindow();
            } else {
                createSearchUI();
            }
        });
    }

    document.querySelectorAll('textarea').forEach(addYouTubeButtonToTextArea);
})();

