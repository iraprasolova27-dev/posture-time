/* =========================================
   POSTURE TIME — ПЕРСОНАЖ
   Выбор персонажа хранится в аккаунте,
   а не только в localStorage.
   ========================================= */

document.addEventListener('DOMContentLoaded', async function () {
    const fallbackAvatar =
        localStorage.getItem('postureTimeAvatar') || '🦊';

    let savedAvatar = fallbackAvatar;

    async function loadAvatar() {
        try {
            const response = await fetch('/api/me/profile', {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                return;
            }

            const user = await response.json();

            if (user.avatar) {
                savedAvatar = user.avatar;
                localStorage.setItem('postureTimeAvatar', savedAvatar);
            }
        } catch (error) {
            // Для публичных страниц без входа используем локальный запасной вариант.
        }
    }

    function updateCharacter(avatar) {
        const elements = document.querySelectorAll(
            '.profile-avatar, .main-character, #mainAvatar, #homeCharacter'
        );

        elements.forEach(function (element) {
            element.textContent = avatar;
            element.classList.add('character');
        });

        document.querySelectorAll('.character-choice').forEach(function (button) {
            button.classList.toggle(
                'selected',
                button.dataset.avatar === avatar
            );
        });
    }

    await loadAvatar();
    updateCharacter(savedAvatar);

    const characterButtons =
        document.querySelectorAll('.character-choice');

    characterButtons.forEach(function (button) {
        button.addEventListener('click', async function () {
            const selectedAvatar = button.dataset.avatar;

            if (!selectedAvatar) {
                return;
            }

            savedAvatar = selectedAvatar;
            localStorage.setItem(
                'postureTimeAvatar',
                selectedAvatar
            );

            updateCharacter(selectedAvatar);

            try {
                const response = await fetch('/api/profile/avatar', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        avatar: selectedAvatar
                    })
                });

                if (!response.ok && response.status !== 401) {
                    console.log('Не удалось сохранить персонажа в аккаунте.');
                }
            } catch (error) {
                console.log('Персонаж сохранён локально.');
            }

            const mainAvatar =
                document.getElementById('mainAvatar');

            if (mainAvatar) {
                mainAvatar.classList.remove('happy');
                void mainAvatar.offsetWidth;
                mainAvatar.classList.add('happy');
            }
        });
    });
});
