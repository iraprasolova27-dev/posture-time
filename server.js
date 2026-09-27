const express = require('express');
const path = require('path');
const session = require('express-session');
const hbs = require('hbs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================
   POSTGRESQL
   ========================================= */

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'posture_time',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '88215',
    max: 10
});

pool.on('error', error => {
    console.error('PostgreSQL pool error:', error.message);
});

async function ensureBaseData() {
    // У каждого пользователя должна быть строка прогресса.
    await pool.query(`
        INSERT INTO user_progress (user_id, xp, level)
        SELECT id, 0, 1
        FROM users
        ON CONFLICT (user_id) DO NOTHING
    `);

    // Четвёртое видео-тренировка.
    await pool.query(`
        INSERT INTO workouts
            (title, description, level, duration_minutes, video_path)
        SELECT 'Тренировка 4', 'Видео тренировки 4.', 'Начальный', 5, '/videos/workout4.mp4'
        WHERE NOT EXISTS (
            SELECT 1 FROM workouts WHERE title = 'Тренировка 4'
        )
    `);

    // Пути к четырём видео. Первые три существовали в старой базе.
    await pool.query(`
        UPDATE workouts SET video_path = '/videos/workout1.mp4'
        WHERE id = (SELECT id FROM workouts ORDER BY id LIMIT 1)
    `);

    await pool.query(`
        UPDATE workouts SET video_path = '/videos/workout2.mp4'
        WHERE id = (SELECT id FROM workouts ORDER BY id OFFSET 1 LIMIT 1)
    `);

    await pool.query(`
        UPDATE workouts SET video_path = '/videos/workout3.mp4'
        WHERE id = (SELECT id FROM workouts ORDER BY id OFFSET 2 LIMIT 1)
    `);

    await pool.query(`
        UPDATE workouts SET video_path = '/videos/workout4.mp4'
        WHERE title = 'Тренировка 4'
    `);
}

pool.connect()
    .then(async client => {
        console.log('PostgreSQL подключён к базе posture_time');
        client.release();
        await ensureBaseData();
        console.log('Базовые данные Posture Time проверены.');
    })
    .catch(error => {
        console.error('Ошибка подключения к PostgreSQL:');
        console.error(error.message);
    });

/* =========================================
   EXPRESS
   ========================================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'posture-time-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));
app.set('views', path.join(__dirname, 'views'));

/* =========================================
   AUTH HELPERS
   ========================================= */

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    next();
}

async function ensureUserProgress(userId) {
    await pool.query(`
        INSERT INTO user_progress (user_id, xp, level)
        VALUES ($1, 0, 1)
        ON CONFLICT (user_id) DO NOTHING
    `, [userId]);
}

async function addXp(userId, amount) {
    await ensureUserProgress(userId);

    const result = await pool.query(`
        UPDATE user_progress
        SET
            xp = xp + $2,
            level = FLOOR((xp + $2) / 100) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING xp, level
    `, [userId, amount]);

    return result.rows[0];
}

async function unlockEligibleAchievements(userId) {
    const stats = await getStats(userId);

    const conditions = [
        { title: 'Первый шаг', unlocked: stats.totalActivities >= 1 },
        { title: 'В движении', unlocked: stats.workouts >= 3 },
        { title: '100 XP', unlocked: stats.xp >= 100 },
        { title: 'Любознательный', unlocked: stats.lessons >= 2 },
        { title: 'Игрок', unlocked: stats.games >= 1 },
        { title: 'Не останавливаюсь', unlocked: stats.totalActivities >= 5 }
    ];

    for (const item of conditions) {
        if (!item.unlocked) continue;

        await pool.query(`
            INSERT INTO user_achievements (user_id, achievement_id)
            SELECT $1, id
            FROM achievements
            WHERE title = $2
            ON CONFLICT (user_id, achievement_id) DO NOTHING
        `, [userId, item.title]);
    }
}

async function getStats(userId) {
    await ensureUserProgress(userId);

    const [workouts, lessons, games, diary, xp, achievements, activityDays, latestAchievement] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*)::int AS count,
                COALESCE(SUM(duration_minutes), 0)::int AS minutes
            FROM workout_sessions
            WHERE user_id = $1 AND completed = TRUE
        `, [userId]),

        pool.query(`
            SELECT COUNT(*)::int AS count
            FROM lesson_progress
            WHERE user_id = $1 AND completed = TRUE
        `, [userId]),

        pool.query(`
            SELECT COUNT(*)::int AS count
            FROM game_results
            WHERE user_id = $1
        `, [userId]),

        pool.query(`
            SELECT
                COUNT(*)::int AS count,
                COALESCE(SUM(duration_minutes), 0)::int AS minutes
            FROM diary_entries
            WHERE user_id = $1
        `, [userId]),

        pool.query(`
            SELECT xp, level
            FROM user_progress
            WHERE user_id = $1
        `, [userId]),

        pool.query(`
            SELECT COUNT(*)::int AS count
            FROM user_achievements
            WHERE user_id = $1
        `, [userId]),

        pool.query(`
            SELECT COUNT(*)::int AS count
            FROM (
                SELECT started_at::date AS activity_date
                FROM workout_sessions
                WHERE user_id = $1 AND completed = TRUE

                UNION

                SELECT completed_at::date AS activity_date
                FROM lesson_progress
                WHERE user_id = $1 AND completed = TRUE AND completed_at IS NOT NULL

                UNION

                SELECT played_at::date AS activity_date
                FROM game_results
                WHERE user_id = $1

                UNION

                SELECT entry_date AS activity_date
                FROM diary_entries
                WHERE user_id = $1
            ) dates
        `, [userId]),

        pool.query(`
            SELECT
                a.title,
                a.description,
                a.icon,
                ua.unlocked_at
            FROM user_achievements ua
            JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = $1
            ORDER BY ua.unlocked_at DESC
            LIMIT 1
        `, [userId]),

        pool.query(`
            WITH days AS (
                SELECT generate_series(
                    date_trunc('week', CURRENT_DATE)::date,
                    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days')::date,
                    INTERVAL '1 day'
                )::date AS activity_date
            ), activity AS (
                SELECT started_at::date AS activity_date
                FROM workout_sessions
                WHERE user_id = $1 AND completed = TRUE

                UNION

                SELECT completed_at::date
                FROM lesson_progress
                WHERE user_id = $1 AND completed = TRUE AND completed_at IS NOT NULL

                UNION

                SELECT played_at::date
                FROM game_results
                WHERE user_id = $1

                UNION

                SELECT entry_date
                FROM diary_entries
                WHERE user_id = $1
            )
            SELECT
                d.activity_date AS date,
                EXISTS (
                    SELECT 1 FROM activity a
                    WHERE a.activity_date = d.activity_date
                ) AS active
            FROM days d
            ORDER BY d.activity_date
        `, [userId])
    ]);

    const workoutCount = workouts.rows[0].count;
    const lessonCount = lessons.rows[0].count;
    const gameCount = games.rows[0].count;
    const diaryCount = diary.rows[0].count;

    return {
        workouts: workoutCount,
        activeMinutes: workouts.rows[0].minutes,
        lessons: lessonCount,
        games: gameCount,
        diaryEntries: diaryCount,
        diaryMinutes: diary.rows[0].minutes,
        xp: xp.rows[0]?.xp || 0,
        level: xp.rows[0]?.level || 1,
        achievements: achievements.rows[0].count,
        activeDays: activityDays.rows[0].count,
        totalActivities: workoutCount + lessonCount + gameCount + diaryCount,
        latestAchievement: latestAchievement.rows[0] || null,
        weekActivity: activityDays.rows.map(row => ({
            date: row.date,
            active: row.active
        }))
    };
}

/* =========================================
   ГЛАВНАЯ
   ========================================= */

app.get('/', (req, res) => {
    res.render('home', {
        title: 'Posture Time',
        isLoggedIn: !!req.session.userId,
        userName: req.session.userName || ''
    });
});

/* =========================================
   РЕГИСТРАЦИЯ
   ========================================= */

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Регистрация — Posture Time'
    });
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.render('register', {
                title: 'Регистрация — Posture Time',
                error: 'Заполни все поля.'
            });
        }

        if (password.length < 6) {
            return res.render('register', {
                title: 'Регистрация — Posture Time',
                error: 'Пароль должен содержать минимум 6 символов.'
            });
        }

        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.render('register', {
                title: 'Регистрация — Posture Time',
                error: 'Пользователь с таким email уже существует.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES ($1, $2, $3, 'child')
            RETURNING id, name, email, avatar, role
        `, [name.trim(), email.trim().toLowerCase(), passwordHash]);

        const user = result.rows[0];

        await ensureUserProgress(user.id);

        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.userAvatar = user.avatar;
        req.session.userRole = user.role;

        res.redirect('/profile');
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.render('register', {
            title: 'Регистрация — Posture Time',
            error: 'Не удалось зарегистрироваться. Проверь подключение к базе данных.'
        });
    }
});

/* =========================================
   ВХОД
   ========================================= */

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Вход — Posture Time'
    });
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('login', {
                title: 'Вход — Posture Time',
                error: 'Заполни email и пароль.'
            });
        }

        const result = await pool.query(`
            SELECT id, name, email, password_hash, avatar, role
            FROM users
            WHERE email = $1
        `, [email.trim().toLowerCase()]);

        if (result.rows.length === 0) {
            return res.render('login', {
                title: 'Вход — Posture Time',
                error: 'Неверный email или пароль.'
            });
        }

        const user = result.rows[0];
        const passwordCorrect = await bcrypt.compare(password, user.password_hash);

        if (!passwordCorrect) {
            return res.render('login', {
                title: 'Вход — Posture Time',
                error: 'Неверный email или пароль.'
            });
        }

        await ensureUserProgress(user.id);

        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.userAvatar = user.avatar;
        req.session.userRole = user.role;

        res.redirect('/profile');
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.render('login', {
            title: 'Вход — Posture Time',
            error: 'Не удалось выполнить вход.'
        });
    }
});

/* =========================================
   ВЫХОД
   ========================================= */

app.get('/logout', (req, res) => {
    req.session.destroy(error => {
        if (error) console.error('Ошибка выхода:', error);
        res.redirect('/');
    });
});

/* =========================================
   API: ПРОФИЛЬ
   ========================================= */

app.get('/api/me/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, age, height_cm,
                   favorite_activity, about, avatar, role
            FROM users
            WHERE id = $1
        `, [req.session.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        res.status(500).json({ error: 'Не удалось загрузить профиль.' });
    }
});

app.post('/api/profile/avatar', requireAuth, async (req, res) => {
    try {
        const avatar = String(req.body.avatar || '').trim();

        if (!avatar) {
            return res.status(400).json({ error: 'Персонаж не выбран.' });
        }

        const result = await pool.query(`
            UPDATE users
            SET avatar = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, name, avatar
        `, [req.session.userId, avatar]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден.' });
        }

        req.session.userAvatar = avatar;
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Ошибка сохранения персонажа:', error);
        res.status(500).json({ error: 'Не удалось сохранить персонажа.' });
    }
});

app.post('/api/profile', requireAuth, async (req, res) => {
    try {
        const {
            name,
            age,
            height,
            favoriteActivity,
            about,
            avatar
        } = req.body;

        const cleanName = String(name || '').trim();
        const cleanAge = age === '' || age == null ? null : Number(age);
        const cleanHeight = height === '' || height == null ? null : Number(height);
        const cleanAbout = String(about || '').trim().slice(0, 500);
        const cleanAvatar = String(avatar || '').trim();

        if (!cleanName) {
            return res.status(400).json({ error: 'Имя не может быть пустым.' });
        }

        if (cleanAge !== null && (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 100)) {
            return res.status(400).json({ error: 'Проверь возраст.' });
        }

        if (cleanHeight !== null && (!Number.isFinite(cleanHeight) || cleanHeight < 50 || cleanHeight > 250)) {
            return res.status(400).json({ error: 'Проверь рост.' });
        }

        const result = await pool.query(`
            UPDATE users
            SET
                name = $2,
                age = $3,
                height_cm = $4,
                favorite_activity = $5,
                about = $6,
                avatar = CASE WHEN $7 = '' THEN avatar ELSE $7 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, name, email, age, height_cm,
                      favorite_activity, about, avatar, role
        `, [
            req.session.userId,
            cleanName,
            cleanAge,
            cleanHeight,
            favoriteActivity || null,
            cleanAbout || null,
            cleanAvatar
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден.' });
        }

        const user = result.rows[0];
        req.session.userName = user.name;
        req.session.userAvatar = user.avatar;

        res.json({ success: true, user });
    } catch (error) {
        console.error('Ошибка сохранения профиля:', error);
        res.status(500).json({ error: 'Не удалось сохранить профиль.' });
    }
});

/* =========================================
   API: СТАТИСТИКА ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
   ========================================= */

app.get('/api/me/stats', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ authenticated: false });
    }

    try {
        await unlockEligibleAchievements(req.session.userId);
        const stats = await getStats(req.session.userId);

        res.json({
            authenticated: true,
            userName: req.session.userName || 'Пользователь',
            ...stats
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Не удалось получить статистику.' });
    }
});

/* =========================================
   API: ДНЕВНИК
   ========================================= */

app.get('/api/diary', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                entry_date AS date,
                mood,
                activity_type AS activity,
                duration_minutes AS duration,
                note,
                created_at
            FROM diary_entries
            WHERE user_id = $1
            ORDER BY entry_date DESC, created_at DESC
        `, [req.session.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка загрузки дневника:', error);
        res.status(500).json({ error: 'Не удалось загрузить дневник.' });
    }
});

app.post('/api/diary', requireAuth, async (req, res) => {
    try {
        const { date, mood, activity, duration, note } = req.body;
        const moodMap = {
            '😀': 'great',
            '🙂': 'good',
            '😐': 'tired',
            '😕': 'not_great',
            '🛑': 'bad'
        };

        if (!date || !moodMap[mood] || !activity) {
            return res.status(400).json({ error: 'Заполни дату, настроение и активность.' });
        }

        const minutes = Math.max(0, Math.min(300, Number(duration) || 0));

        const result = await pool.query(`
            INSERT INTO diary_entries
                (user_id, entry_date, mood, activity_type, duration_minutes, note)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, entry_date AS date, mood, activity_type AS activity,
                      duration_minutes AS duration, note, created_at
        `, [
            req.session.userId,
            date,
            moodMap[mood],
            activity,
            minutes,
            note || null
        ]);

        await addXp(req.session.userId, 20);
        await unlockEligibleAchievements(req.session.userId);

        res.status(201).json({
            entry: result.rows[0],
            stats: await getStats(req.session.userId)
        });
    } catch (error) {
        console.error('Ошибка сохранения дневника:', error);
        res.status(500).json({ error: 'Не удалось сохранить запись.' });
    }
});

/* =========================================
   API: ТРЕНИРОВКИ
   ========================================= */

app.post('/api/workouts/:id/complete', requireAuth, async (req, res) => {
    try {
        const videoNumber = Number(req.params.id);
        const durationSeconds = Math.max(0, Number(req.body.durationSeconds) || 0);

        if (!Number.isInteger(videoNumber) || videoNumber < 1 || videoNumber > 4) {
            return res.status(400).json({ error: 'Неверный номер тренировки.' });
        }

        const workout = await pool.query(
            'SELECT id FROM workouts ORDER BY id OFFSET $1 LIMIT 1',
            [videoNumber - 1]
        );

        if (workout.rows.length === 0) {
            return res.status(404).json({ error: 'Тренировка не найдена.' });
        }

        const workoutId = workout.rows[0].id;
        // Повторное завершение тоже является отдельной тренировкой.
        const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

        await pool.query(`
            INSERT INTO workout_sessions
                (user_id, workout_id, started_at, finished_at,
                 duration_minutes, completed)
            VALUES ($1, $2,
                    CURRENT_TIMESTAMP - ($3 || ' seconds')::interval,
                    CURRENT_TIMESTAMP,
                    $4, TRUE)
        `, [req.session.userId, workoutId, durationSeconds, durationMinutes]);

        await addXp(req.session.userId, 20);
        await unlockEligibleAchievements(req.session.userId);

        res.json({
            success: true,
            stats: await getStats(req.session.userId)
        });
    } catch (error) {
        console.error('Ошибка сохранения тренировки:', error);
        res.status(500).json({ error: 'Не удалось сохранить тренировку.' });
    }
});

/* =========================================
   API: УРОКИ
   ========================================= */

app.post('/api/lessons/:id/complete', requireAuth, async (req, res) => {
    try {
        const lessonNumber = Number(req.params.id);

        if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 10) {
            return res.status(400).json({ error: 'Неверный номер урока.' });
        }

        const lesson = await pool.query(
            'SELECT id FROM lessons ORDER BY id OFFSET $1 LIMIT 1',
            [lessonNumber - 1]
        );

        if (lesson.rows.length === 0) {
            return res.status(404).json({ error: 'Урок не найден.' });
        }

        const lessonId = lesson.rows[0].id;

        const existing = await pool.query(`
            SELECT completed
            FROM lesson_progress
            WHERE user_id = $1 AND lesson_id = $2
        `, [req.session.userId, lessonId]);

        await pool.query(`
            INSERT INTO lesson_progress
                (user_id, lesson_id, completed, completed_at)
            VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET completed = TRUE, completed_at = CURRENT_TIMESTAMP
        `, [req.session.userId, lessonId]);

        // XP за конкретный урок выдаём только один раз.
        if (!existing.rows[0]?.completed) {
            await addXp(req.session.userId, 10);
        }

        await unlockEligibleAchievements(req.session.userId);

        res.json({
            success: true,
            stats: await getStats(req.session.userId)
        });
    } catch (error) {
        console.error('Ошибка сохранения урока:', error);
        res.status(500).json({ error: 'Не удалось сохранить урок.' });
    }
});

/* =========================================
   API: ИГРЫ
   ========================================= */

app.post('/api/games/:id/result', requireAuth, async (req, res) => {
    try {
        const gameNumber = Number(req.params.id);
        const score = Math.max(0, Math.floor(Number(req.body.score) || 0));

        if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > 6) {
            return res.status(400).json({ error: 'Неверный номер игры.' });
        }

        const game = await pool.query(
            'SELECT id FROM games ORDER BY id OFFSET $1 LIMIT 1',
            [gameNumber - 1]
        );

        if (game.rows.length === 0) {
            return res.status(404).json({ error: 'Игра не найдена.' });
        }

        const gameId = game.rows[0].id;

        await pool.query(`
            INSERT INTO game_results (user_id, game_id, score)
            VALUES ($1, $2, $3)
        `, [req.session.userId, gameId, score]);

        // Игра даёт XP за завершённый раунд, но ограничиваем награду.
        const gameXp = Math.min(20, 5 + Math.floor(score / 50));
        await addXp(req.session.userId, gameXp);
        await unlockEligibleAchievements(req.session.userId);

        res.json({
            success: true,
            xpEarned: gameXp,
            stats: await getStats(req.session.userId)
        });
    } catch (error) {
        console.error('Ошибка сохранения игры:', error);
        res.status(500).json({ error: 'Не удалось сохранить результат игры.' });
    }
});

/* =========================================
   СТРАНИЦЫ
   ========================================= */

app.get('/workouts', (req, res) => {
    res.render('workouts', {
        title: 'Тренировки — Posture Time'
    });
});

app.get('/workouts/:id', (req, res) => {
    res.render('workout', {
        title: 'Тренировка — Posture Time'
    });
});

app.get('/lessons', (req, res) => {
    res.render('lessons', {
        title: 'Учимся — Posture Time'
    });
});

app.get('/games', (req, res) => {
    res.render('games', {
        title: 'Игры — Posture Time'
    });
});

for (let i = 1; i <= 6; i++) {
    app.get(`/games/${i}`, (req, res) => {
        res.render(`game${i}`, {
            title: `Игра ${i} — Posture Time`
        });
    });
}

app.get('/diary', requireAuth, (req, res) => {
    res.render('diary', {
        title: 'Дневник — Posture Time'
    });
});

app.get('/progress', requireAuth, (req, res) => {
    res.render('progress', {
        title: 'Прогресс — Posture Time'
    });
});

app.get('/achievements', requireAuth, (req, res) => {
    res.render('achievements', {
        title: 'Достижения — Posture Time'
    });
});

app.get('/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, age, height_cm,
                   favorite_activity, about, avatar, role
            FROM users
            WHERE id = $1
        `, [req.session.userId]);

        if (result.rows.length === 0) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        res.render('profile', {
            title: 'Профиль — Posture Time',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        res.status(500).send('Ошибка загрузки профиля.');
    }
});

app.get('/settings', requireAuth, (req, res) => {
    res.render('settings', {
        title: 'Настройки — Posture Time'
    });
});

/* =========================================
   УРОКИ 1–10
   ========================================= */

const lessonViews = {
    1: 'lesson',
    2: 'lesson2',
    3: 'lesson3',
    4: 'lesson4',
    5: 'lesson5',
    6: 'lesson6',
    7: 'lesson7',
    8: 'lesson8',
    9: 'lesson9',
    10: 'lesson10'
};

app.get('/lessons/:id', (req, res) => {
    const id = Number(req.params.id);
    const view = lessonViews[id];

    if (!view) {
        return res.status(404).send('Урок не найден');
    }

    res.render(view, {
        title: `Урок ${id} — Posture Time`
    });
});

/* =========================================
   ЗАПУСК
   ========================================= */

app.listen(PORT, () => {
    console.log(`Posture Time запущен: http://localhost:${PORT}`);
});
