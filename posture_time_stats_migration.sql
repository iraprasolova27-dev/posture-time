-- POSTURE TIME — исправление персональной статистики
-- Запустить один раз в базе posture_time.

-- 1. У каждого пользователя должна быть собственная строка прогресса.
INSERT INTO user_progress (user_id, xp, level)
SELECT id, 0, 1
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 2. Добавляем четвёртую тренировку для workout4.mp4.
INSERT INTO workouts
    (title, description, level, duration_minutes, video_path)
SELECT
    'Тренировка 4',
    'Видео тренировки 4.',
    'Начальный',
    5,
    '/videos/workout4.mp4'
WHERE NOT EXISTS (
    SELECT 1
    FROM workouts
    WHERE title = 'Тренировка 4'
);

-- 3. Пути локальных видео для четырёх тренировок.
UPDATE workouts SET video_path = '/videos/workout1.mp4'
WHERE id = (SELECT id FROM workouts ORDER BY id LIMIT 1);

UPDATE workouts SET video_path = '/videos/workout2.mp4'
WHERE id = (SELECT id FROM workouts ORDER BY id OFFSET 1 LIMIT 1);

UPDATE workouts SET video_path = '/videos/workout3.mp4'
WHERE id = (SELECT id FROM workouts ORDER BY id OFFSET 2 LIMIT 1);

UPDATE workouts SET video_path = '/videos/workout4.mp4'
WHERE title = 'Тренировка 4';

-- 4. На всякий случай добавляем достижения, которых может не быть.
INSERT INTO achievements (title, description, icon, xp_reward) VALUES
('Первый шаг','Первая активность в Posture Time','🌱',20),
('В движении','Выполнено 3 тренировки','🏃',30),
('100 XP','Набрано 100 XP','⭐',50),
('Любознательный','Изучено 2 урока','📚',30),
('Игрок','Сыграна первая игра','🎮',20),
('Не останавливаюсь','Выполнено 5 активностей','🔥',50)
ON CONFLICT (title) DO NOTHING;
