/* =========================================
   POSTURE TIME — МУЗЫКА ДЛЯ ИГР
   ========================================= */

document.addEventListener('DOMContentLoaded', function () {

    const tracks = [
        {
            name: 'Curious Adventure',
            file: '/audio/curious-adventure_88.mp3'
        },
        {
            name: 'Детская',
            file: '/audio/DJ%20ALESHKIN%20%E2%80%94%20%D0%94%D0%B5%D1%82%D1%81%D0%BA%D0%B0%D1%8F.mp3'
        }
    ];


    /* =========================
       СОЗДАЁМ АУДИО
    ========================== */

    const audio = document.createElement('audio');

    audio.preload = 'auto';
    audio.loop = false;

    document.body.appendChild(audio);


    /* =========================
       СОСТОЯНИЕ
    ========================== */

    let currentTrack = 0;

    let musicEnabled =
        localStorage.getItem('postureTimeGameMusic') !== 'off';

    let volume =
        parseFloat(
            localStorage.getItem('postureTimeGameVolume')
        );

    if (Number.isNaN(volume)) {
        volume = 0.35;
    }

    audio.volume = volume;


    /* =========================
       СОЗДАЁМ ПЛЕЕР
    ========================== */

    const musicBox = document.createElement('div');

    musicBox.className = 'game-music-box';

    musicBox.innerHTML = `

        <button
            type="button"
            class="game-music-toggle"
            id="gameMusicToggle"
            aria-label="Открыть музыку"
        >
            🎵
        </button>

        <div class="game-music-panel">

            <div class="game-music-header">

                <div class="game-music-title">
                    🎵 Музыка игры
                </div>

                <button
                    type="button"
                    class="game-music-close"
                    id="gameMusicClose"
                    aria-label="Закрыть панель музыки"
                >
                    ×
                </button>

            </div>


            <div class="game-music-track">

                <span id="gameMusicTrackName">
                    ${tracks[currentTrack].name}
                </span>

            </div>


            <div class="game-music-controls">

                <button
                    type="button"
                    class="game-music-button"
                    id="gameMusicPrevious"
                    aria-label="Предыдущая песня"
                >
                    ⏮
                </button>


                <button
                    type="button"
                    class="game-music-button game-music-main"
                    id="gameMusicPlay"
                    aria-label="Включить музыку"
                >
                    ▶
                </button>


                <button
                    type="button"
                    class="game-music-button"
                    id="gameMusicNext"
                    aria-label="Следующая песня"
                >
                    ⏭
                </button>


                <button
                    type="button"
                    class="game-music-button"
                    id="gameMusicMute"
                    aria-label="Выключить музыку"
                >
                    🔊
                </button>

            </div>


            <div class="game-music-volume">

                <span>🔈</span>

                <input
                    type="range"
                    id="gameMusicVolume"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${volume}"
                    aria-label="Громкость музыки"
                >

                <span>🔊</span>

            </div>

        </div>
    `;


    document.body.appendChild(musicBox);


    /* =========================
       СТИЛИ ПЛЕЕРА
    ========================== */

    const style = document.createElement('style');

    style.textContent = `

        .game-music-box {
            position: fixed;
            right: 18px;
            bottom: 18px;
            z-index: 9999;
        }


        /* Маленькая кнопка музыки */

        .game-music-toggle {

            width: 52px;
            height: 52px;

            border: none;
            border-radius: 50%;

            background: white;

            box-shadow:
                0 8px 25px rgba(40, 80, 130, 0.18);

            font-size: 23px;

            cursor: pointer;

            transition:
                transform 0.2s ease,
                background 0.2s ease;

        }


        .game-music-toggle:hover {
            transform: translateY(-2px);
            background: #f5f9ff;
        }


        /* Панель */

        .game-music-panel {

            display: none;

            width: 280px;

            padding: 18px;

            margin-bottom: 10px;

            background: rgba(255, 255, 255, 0.98);

            border: 1px solid rgba(80, 120, 160, 0.10);

            border-radius: 22px;

            box-shadow:
                0 15px 40px rgba(40, 80, 130, 0.16);

            backdrop-filter: blur(10px);

        }


        .game-music-box.open .game-music-panel {
            display: block;
        }


        /* Заголовок */

        .game-music-header {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 10px;

            margin-bottom: 8px;

        }


        .game-music-title {

            color: #24466f;

            font-size: 16px;

            font-weight: 800;

        }


        .game-music-close {

            width: 36px;
            height: 36px;

            border: none;

            border-radius: 12px;

            background: #eef5ff;

            color: #315a91;

            font-size: 24px;

            line-height: 1;

            cursor: pointer;

        }


        .game-music-close:active {
            transform: scale(.94);
        }


        /* Название песни */

        .game-music-track {

            min-height: 22px;

            margin-bottom: 12px;

            color: #667085;

            font-size: 13px;

            font-weight: 600;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

        }


        /* Кнопки */

        .game-music-controls {

            display: flex;

            align-items: center;

            justify-content: center;

            gap: 8px;

        }


        .game-music-button {

            display: flex;

            align-items: center;

            justify-content: center;

            width: 42px;

            height: 42px;

            padding: 0;

            border: none;

            border-radius: 14px;

            background: #eef5ff;

            color: #315a91;

            font-size: 17px;

            cursor: pointer;

            transition:
                transform 0.2s ease,
                background 0.2s ease;

        }


        .game-music-button:hover {

            transform: translateY(-2px);

            background: #e3efff;

        }


        .game-music-main {

            width: 48px;

            height: 48px;

            background: linear-gradient(
                135deg,
                #63cfa5,
                #4db7d7
            );

            color: white;

            font-size: 20px;

        }


        /* Громкость */

        .game-music-volume {

            display: flex;

            align-items: center;

            gap: 8px;

            margin-top: 14px;

            color: #667085;

            font-size: 13px;

        }


        .game-music-volume input {

            flex: 1;

            min-width: 0;

            accent-color: #63cfa5;

            cursor: pointer;

        }


        /* Телефон */

        @media (max-width: 600px) {

            .game-music-box {

                right: 12px;

                bottom: 12px;

            }


            .game-music-toggle {

                width: 48px;

                height: 48px;

                font-size: 21px;

            }


            .game-music-panel {

                width: min(300px, calc(100vw - 24px));

                max-width: calc(100vw - 24px);

                padding: 15px;

            }


            .game-music-button {

                min-width: 44px;

                min-height: 44px;

            }

        }


        @media (prefers-reduced-motion: reduce) {

            .game-music-button,
            .game-music-toggle {

                transition: none;

            }

        }

    `;


    document.head.appendChild(style);


    /* =========================
       ЭЛЕМЕНТЫ
    ========================== */

    const toggleButton =
        document.getElementById('gameMusicToggle');

    const closeButton =
        document.getElementById('gameMusicClose');

    const playButton =
        document.getElementById('gameMusicPlay');

    const muteButton =
        document.getElementById('gameMusicMute');

    const previousButton =
        document.getElementById('gameMusicPrevious');

    const nextButton =
        document.getElementById('gameMusicNext');

    const volumeInput =
        document.getElementById('gameMusicVolume');

    const trackName =
        document.getElementById('gameMusicTrackName');


    /* =========================
       ОТКРЫТЬ / ЗАКРЫТЬ
    ========================== */

    toggleButton.addEventListener(
        'click',
        function () {

            musicBox.classList.add('open');

            toggleButton.setAttribute(
                'aria-label',
                'Закрыть музыку'
            );

        }
    );


    closeButton.addEventListener(
        'click',
        function () {

            musicBox.classList.remove('open');

            toggleButton.setAttribute(
                'aria-label',
                'Открыть музыку'
            );

        }
    );


    /* =========================
       ЗАГРУЗКА ТРЕКА
    ========================== */

    function loadTrack(index, shouldPlay) {

        currentTrack =
            (index + tracks.length) % tracks.length;

        audio.src =
            tracks[currentTrack].file;

        trackName.textContent =
            tracks[currentTrack].name;


        if (shouldPlay && musicEnabled) {

            const playPromise =
                audio.play();

            if (playPromise !== undefined) {

                playPromise.catch(function () {
                    /*
                        Браузер может запретить
                        автоматический запуск.
                        Пользователь сможет нажать ▶.
                    */
                });

            }

        }

        updateButtons();

    }


    /* =========================
       КНОПКИ
    ========================== */

    function updateButtons() {

        if (!musicEnabled) {

            playButton.textContent = '▶';

            muteButton.textContent = '🔇';

            muteButton.setAttribute(
                'aria-label',
                'Включить музыку'
            );

            return;
        }


        muteButton.textContent = '🔊';

        muteButton.setAttribute(
            'aria-label',
            'Выключить музыку'
        );


        if (audio.paused) {

            playButton.textContent = '▶';

            playButton.setAttribute(
                'aria-label',
                'Включить музыку'
            );

        } else {

            playButton.textContent = '⏸';

            playButton.setAttribute(
                'aria-label',
                'Поставить музыку на паузу'
            );

        }

    }


    /* =========================
       PLAY / PAUSE
    ========================== */

    playButton.addEventListener(
        'click',
        function () {

            if (!musicEnabled) {

                musicEnabled = true;

                localStorage.setItem(
                    'postureTimeGameMusic',
                    'on'
                );


                if (!audio.src) {

                    loadTrack(
                        currentTrack,
                        false
                    );

                }


                audio.play().catch(function () {});

                updateButtons();

                return;
            }


            if (audio.paused) {

                audio.play().catch(function () {});

            } else {

                audio.pause();

            }

            updateButtons();

        }
    );


    /* =========================
       MUTE
    ========================== */

    muteButton.addEventListener(
        'click',
        function () {

            musicEnabled = !musicEnabled;


            if (musicEnabled) {

                localStorage.setItem(
                    'postureTimeGameMusic',
                    'on'
                );

                audio.play().catch(function () {});

            } else {

                localStorage.setItem(
                    'postureTimeGameMusic',
                    'off'
                );

                audio.pause();

            }

            updateButtons();

        }
    );


    /* =========================
       ПРЕДЫДУЩИЙ ТРЕК
    ========================== */

    previousButton.addEventListener(
        'click',
        function () {

            loadTrack(
                currentTrack - 1,
                musicEnabled
            );

        }
    );


    /* =========================
       СЛЕДУЮЩИЙ ТРЕК
    ========================== */

    nextButton.addEventListener(
        'click',
        function () {

            loadTrack(
                currentTrack + 1,
                musicEnabled
            );

        }
    );


    /* =========================
       ГРОМКОСТЬ
    ========================== */

    volumeInput.addEventListener(
        'input',
        function () {

            const newVolume =
                parseFloat(
                    volumeInput.value
                );


            audio.volume =
                newVolume;


            localStorage.setItem(
                'postureTimeGameVolume',
                String(newVolume)
            );

        }
    );


    /* =========================
       ТРЕК ЗАКОНЧИЛСЯ
    ========================== */

    audio.addEventListener(
        'ended',
        function () {

            loadTrack(
                currentTrack + 1,
                musicEnabled
            );

        }
    );


    /* =========================
       СИНХРОНИЗАЦИЯ КНОПКИ
    ========================== */

    audio.addEventListener(
        'play',
        updateButtons
    );


    audio.addEventListener(
        'pause',
        updateButtons
    );


    /* =========================
       НАЧАЛЬНАЯ ЗАГРУЗКА
    ========================== */

    loadTrack(
        currentTrack,
        false
    );


    updateButtons();

});