import React, { useState, useRef, useEffect } from 'react';
import { ReactComponent as Upward } from './icons/arrow_upward_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const LM_STUDIO_HOST = 'http://127.0.0.1:1234'
const LM_STUDIO_DEFAULT_MODEL = 'meta-llama-3.1-8b-instruct'
const API_HOST = 'http://127.0.0.1:8888'

// ------------------ Sidebar ------------------
const Sidebar = ({ uniqueTitles, onSelectTitle, onNewChat }) => {
  return (
    <section className="side-bar">
      <button onClick={onNewChat}>Новый чат</button>
      <ul className="history">
        <p className="history-title">История</p>
        {uniqueTitles?.map((title, index) => (
          <li key={index} onClick={() => onSelectTitle(title)}>
            {title}
          </li>
        ))}
      </ul>
      <nav>
        <p>Посмотреть планы</p>
      </nav>
    </section>
  );
};

// ------------------ Header ------------------
const Header = ({ source, onSourceChange }) => {
  return (
    <div className="main-header">
      <div className="source-options">
        <button
          className={`source-button ${source === 'msd' ? 'active' : ''}`}
          onClick={() => onSourceChange('msd')}
        >
          MSD справочник
        </button>
        <button
          className={`source-button ${source === 'clinrec' ? 'active' : ''}`}
          onClick={() => onSourceChange('clinrec')}
        >
          Клинические рекомендации
        </button>
      </div>
      <h1 className="Name">MedQuest</h1>
    </div>
  );
};

// ------------------ ChatFeed ------------------
const ChatFeed = ({ currentChat }) => {
  return (
    <ul className="feed">
      {currentChat?.map((chatMessage, index) => (
        <li className="feed-item" key={index}>
          <p className="role">{chatMessage.role === 'assistant' ? 'MedQuest' : 'User'}</p>
          <p className="message">
            <Markdown remarkPlugins={[remarkGfm]}>{chatMessage.content}</Markdown>
          </p>
        </li>
      ))}
    </ul>
  );
};

// ------------------ MessageInput ------------------
const MessageInput = ({ value, onChange, onSend, loading }) => {
  const textareaRef = useRef(null);

  // Автоматическое изменение высоты текстового поля
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto'; // сброс высоты
    const lines = textarea.value.split('\n');
    const lineCount = lines.length;
    const maxHeight = 150; // максимум пикселей по высоте
    const lineHeight = 24; // примерная высота строки
    const minHeight = 50;

    const newHeight = Math.min(lineCount * lineHeight, maxHeight);
    textarea.style.height = `${Math.max(newHeight, minHeight)}px`;
  };

  // Отправка сообщения при нажатии Enter (без Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="bottom-section">
      <div className="input-container">
        <textarea
          value={value}
          onChange={onChange}
          ref={textareaRef}
          placeholder="Сообщение для MedQuest"
          rows={1}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          style={{
            minHeight: '50px',
            maxHeight: '150px',
          }}
        />
        <div id="submit" onClick={onSend} className={loading ? 'animate' : ''}>
          <Upward />
        </div>
      </div>
      <p className="info">
        MedQuest может допускать ошибки. Рекомендуем проверять важную информацию.
      </p>
    </div>
  );
};

// ------------------ Main App ------------------
const App = () => {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const [previousChats, setPreviousChats] = useState(() => {
    const saved = localStorage.getItem('previousChats');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTitle, setCurrentTitle] = useState(() => {
    const saved = localStorage.getItem('currentTitle');
    return saved ? JSON.parse(saved) : null;
  });

  // Источник (msd/clinrec)
  const [source, setSource] = useState(() => {
    if (!currentTitle || !previousChats) return 'msd';
    const chats = previousChats.filter((ch) => ch.title === currentTitle);
    const currentSource = chats?.slice(-1)[0]?.source;
    return currentSource || 'msd';
  });

  // Смена источника
  const handleSourceClick = (newSource) => {
    setSource(newSource);
  };

  // Создать новый чат
  const createNewChat = () => {
    setMessage(null);
    setValue('');
    setCurrentTitle(null);
  };

  // Переключение между чатами в истории
  const handleClickTitle = (title) => {
    setCurrentTitle(title);
    setMessage(null);
    setValue('');
  };

  // Запрос контекста на сервере
  const getContext = async () => {
    try {
      const response = await fetch(`${API_HOST}/question?` + new URLSearchParams({
        q: value,
        source: source,
      }).toString())
      const data = await response.json()
      return {
        prompt: data.prompt,
        sources: data.sources,
      };
    } catch (error) {
      console.error(error);
      return { prompt: '', sources: [] };
    }
  };

  // Запрос ответа на основе контекста
  const getMessages = async () => {
    if (!value) return;
    setLoading(true);

    // Сначала получаем контекст
    const context = await getContext();
    if (!context.sources?.length) {
      setMessage({
        role: 'assistant',
        content: 'Не удалось найти информацию по вашему вопросу.',
      });
      setLoading(false);
      return;
    }

    try {
      const lmstudio = createOpenAICompatible({
        baseURL: `${LM_STUDIO_HOST}/v1`,
      });
      const { text } = await generateText({
        model: lmstudio(LM_STUDIO_DEFAULT_MODEL),
        prompt: context.prompt,
      });

      const message = {
        role: 'assistant',
        content: text,
      };
      console.log(context.sources)
      // Формируем строку с источниками (ссылки)
      const sourcesString =
        '\n\n**Источники:**\n\n' +
        context.sources
          .map((src) => `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;![pdf](/description.png) [${src.name}](${src.link})`)
          .join('\n\n');

      // Доклеиваем к ответу
      message.content += sourcesString;
      setMessage(message);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Синхронизация в localStorage
  useEffect(() => {
    localStorage.setItem('previousChats', JSON.stringify(previousChats));
    localStorage.setItem('currentTitle', JSON.stringify(currentTitle));
  }, [previousChats, currentTitle]);

  // Обновляем source при смене чата
  useEffect(() => {
    const chats = previousChats.filter((ch) => ch.title === currentTitle);
    const currentSource = chats?.slice(-1)[0]?.source;
    if (currentSource) {
      setSource(currentSource);
    }
  }, [currentTitle, previousChats]);

  // Сохраняем новый (или существующий) чат в историю
  useEffect(() => {
    if (!currentTitle && value && message) {
      // если заголовка нет, создаём новый
      setCurrentTitle(value);
    }
    if (currentTitle && value && message) {
      setPreviousChats((prevChats) => [
        ...prevChats,
        {
          title: currentTitle,
          role: 'user',
          source: source,
          content: value,
        },
        {
          title: currentTitle,
          role: message.role,
          source: source,
          content: message.content,
        },
      ]);
      setValue('');
    }
  }, [message, currentTitle, value, source]);

  // Фильтруем сообщения текущего чата
  const currentChat = previousChats.filter((ch) => ch.title === currentTitle);
  // Собираем уникальные заголовки (история)
  const uniqueTitles = Array.from(new Set(previousChats.map((ch) => ch.title)));

  return (
    <div className="App">
      <Sidebar
        uniqueTitles={uniqueTitles}
        onSelectTitle={handleClickTitle}
        onNewChat={createNewChat}
      />
      <div className="mainElemets">
        <Header source={source} onSourceChange={handleSourceClick} />

        <section className="main">
          <ChatFeed currentChat={currentChat} />
          <MessageInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onSend={getMessages}
            loading={loading}
          />
        </section>
      </div>
    </div>
  );
};

export default App;
