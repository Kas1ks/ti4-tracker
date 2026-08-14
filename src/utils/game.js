export const formatTime = (totalSeconds) => {
            export const mins = Math.floor(totalSeconds / 60);
            export const secs = totalSeconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        // Функция для перемешивания массива (алгоритм Фишера-Йейтса)
        export const shuffleArray = (array) => {
            let currentIndex = array.length, randomIndex;
            while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
            }
            return array;
        };
