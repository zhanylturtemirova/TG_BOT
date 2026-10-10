# Bot API на Mac и перенос на другой сервер

Собственный Telegram Bot API с `--local` принимает файл до 2000 МБ. Бот отправляет его потоком целиком. Сервер и бот — два отдельных процесса; оба должны работать. Mac должен быть включён и подключён к интернету, сон приостанавливает работу.

## Установка на Mac

Нужны Xcode Command Line Tools, Homebrew, Node.js 22+ и ffmpeg. Сервер собирается из официального репозитория Telegram, без Docker:

```bash
brew install cmake openssl@3
git clone --recursive https://github.com/tdlib/telegram-bot-api.git .local/telegram-bot-api-src
git -C .local/telegram-bot-api-src checkout e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1
git -C .local/telegram-bot-api-src submodule update --init --recursive
cmake -S .local/telegram-bot-api-src -B .local/telegram-bot-api-build \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PWD/.local" \
  -DOPENSSL_ROOT_DIR="$(brew --prefix openssl@3)"
cmake --build .local/telegram-bot-api-build --target install -j 4
```

Выполняйте из корня проекта. Если исходники уже установлены, повторно клонировать их не нужно. `.local/` исключена из Git; здесь лежат бинарник, исходники сборки и постоянные данные сервера. Не удаляйте `bot-api-data` во время работы.

В [API development tools](https://my.telegram.org/apps) получите `api_id` и `api_hash`. Это параметры приложения разработчика, не новый бот и не токен BotFather. Добавьте в `.env`:

```dotenv
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

Существующий `BOT_API_KEY` оставьте. Не публикуйте `.env`, `api_hash`, токен и данные сервера. Ключи передаются серверу через окружение, а не аргументы командной строки.

## Первый запуск

В первом терминале:

```bash
npm run bot-api:start
```

Сервер слушает только `127.0.0.1:8081`, недоступен с других компьютеров. Можно изменить `BOT_API_PORT` или указать другой бинарник в `BOT_API_EXECUTABLE`.

Остановите прежний процесс бота через Ctrl+C и дождитесь окончания текущих заданий. Во втором терминале выполните:

```bash
npm run bot-api:switch -- http://127.0.0.1:8081
npm start
```

Команда проверяет доступность нового сервера, вызывает `logOut` на прежнем, записывает `TELEGRAM_API_ROOT` и `TELEGRAM_LOCAL_MODE` в `.env`, затем проверяет авторизацию бота. Проверка HTTP-доступности не гарантирует правильность `api_id`/`api_hash` или наличие `--local`; поэтому завершение авторизации проверяется отдельно. После выхода из облачного API возврат на него недоступен 10 минут.

Если авторизация нового сервера не завершилась, новый адрес остаётся в `.env`: исправьте причину и повторите ту же команду. При совпадении текущего и целевого адреса повторный `logOut` не выполняется. Во время переключения не редактируйте `.env` и не запускайте вторую команду переноса.

При следующих запусках достаточно `npm run bot-api:start` в одном терминале и `npm start` в другом. Повторять перенос не нужно. Ctrl+C останавливает соответствующий процесс. Команды не устанавливают автозапуск при входе в macOS.

## Перенос с Mac на VPS или другой Bot API

1. Подготовьте новый Bot API с `--local` и своими `api_id`/`api_hash`. Для удалённого подключения настройте HTTPS и лимит/таймаут прокси для файлов до 2000 МБ.
2. Остановите процесс бота и дождитесь завершения загрузок. Прежний сервер Bot API оставьте работающим до завершения `logOut`.
3. Выполните, подставив настоящий адрес:

```bash
npm run bot-api:switch -- https://bot-api.example.com
npm start
```

Код менять не нужно. Сервер назначения получает токен бота: используйте собственный сервер или доверенного провайдера. Команда переноса не разворачивает удалённый сервер и не копирует его накопленные файлы. Для переноса всего проекта на VPS отдельно перенесите `.env` по защищённому каналу, установите зависимости и убедитесь, что копия бота на Mac остановлена.

Для возвращения на облачный API (с лимитом 50 МБ):

```bash
npm run bot-api:switch -- https://api.telegram.org
```

Команды переноса предназначены для текущего бота с long polling. Они не настраивают webhook и не удаляют очередь обновлений.

Источники: [официальный сервер Telegram](https://github.com/tdlib/telegram-bot-api), [локальный режим](https://core.telegram.org/bots/api#using-a-local-bot-api-server), [получение параметров приложения](https://core.telegram.org/api/obtaining_api_id).
