/* =========================================
   POSTURE TIME — ЕДИНАЯ СТАТИСТИКА
   Все действия сохраняются для текущего
   пользователя через сервер и PostgreSQL.
   ========================================= */

(function () {
    'use strict';

    async function request(url, options) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                ...(options && options.headers ? options.headers : {})
            },
            ...(options || {})
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || 'Не удалось выполнить действие.');
        }

        return data;
    }

    function applyHeaderStats(stats) {
        if (!stats || !stats.authenticated) {
            return;
        }

        const profileName = document.querySelector('.profile-info strong');
        const profileLevel = document.querySelector('.profile-info span');

        if (profileName) {
            profileName.textContent = stats.userName || 'Пользователь';
        }

        if (profileLevel) {
            profileLevel.textContent = 'Уровень ' + stats.level;
        }
    }

    async function refreshStats() {
        try {
            const stats = await request('/api/me/stats');
            applyHeaderStats(stats);

            document.dispatchEvent(
                new CustomEvent('posturetime:stats', {
                    detail: stats
                })
            );

            return stats;
        } catch (error) {
            console.error('Posture Time stats:', error.message);
            return null;
        }
    }

    async function saveWorkout(workoutId, durationSeconds) {
        const data = await request(
            '/api/workouts/' + encodeURIComponent(workoutId) + '/complete',
            {
                method: 'POST',
                body: JSON.stringify({
                    durationSeconds: Number(durationSeconds) || 0
                })
            }
        );

        applyHeaderStats(data.stats);
        document.dispatchEvent(
            new CustomEvent('posturetime:stats', {
                detail: data.stats
            })
        );

        return data;
    }

    async function saveLesson(lessonId) {
        const data = await request(
            '/api/lessons/' + encodeURIComponent(lessonId) + '/complete',
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        );

        applyHeaderStats(data.stats);
        document.dispatchEvent(
            new CustomEvent('posturetime:stats', {
                detail: data.stats
            })
        );

        return data;
    }

    async function saveGame(gameId, score) {
        const data = await request(
            '/api/games/' + encodeURIComponent(gameId) + '/result',
            {
                method: 'POST',
                body: JSON.stringify({
                    score: Number(score) || 0
                })
            }
        );

        applyHeaderStats(data.stats);
        document.dispatchEvent(
            new CustomEvent('posturetime:stats', {
                detail: data.stats
            })
        );

        return data;
    }

    window.PostureTime = {
        request,
        refreshStats,
        saveWorkout,
        saveLesson,
        saveGame
    };

    document.addEventListener('DOMContentLoaded', function () {
        refreshStats();
    });
})();
