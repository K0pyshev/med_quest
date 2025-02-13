import React, { useState, useEffect } from 'react';
import { ReactComponent as Upward } from './icons/arrow_upward_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamText } from 'ai';
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { Message } from './Message'; // <-- наш компонент с логикой стриминга

const LM_STUDIO_HOST = 'http://127.0.0.1:1234';
const LM_STUDIO_DEFAULT_MODEL = 'meta-llama-3.1-8b-instruct';
const API_HOST = 'http://127.0.0.1:8888';

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
      {currentChat?.map((msg, index) => (
        <Message
          key={index}
          role={msg.role}
          content={msg.content}
          stream={msg.stream}
          sourcesString={msg.sourcesString}
        />
      ))}
    </ul>
  );
};

// ------------------ MessageInput ------------------
const MessageInput = ({ value, onChange, onSend, loading }) => {
  // Функция для авто-увеличения высоты текстового поля
  const handleInput = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    const lines = textarea.value.split('\n');
    const lineCount = lines.length;
    const maxHeight = 150;
    const lineHeight = 24;
    const minHeight = 50;

    const newHeight = Math.min(lineCount * lineHeight, maxHeight);
    textarea.style.height = `${Math.max(newHeight, minHeight)}px`;
  };

  // Отправка при Enter (без Shift)
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
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');

  // Массив всех сообщений (всех чатов)
  const [previousChats, setPreviousChats] = useState(() => {
    const saved = localStorage.getItem('previousChats');
    return saved ? JSON.parse(saved) : [];
  });

  // Текущий чат (заголовок)
  const [currentTitle, setCurrentTitle] = useState(() => {
    const saved = localStorage.getItem('currentTitle');
    return saved ? JSON.parse(saved) : null;
  });

  // Текущий источник (msd или clinrec)
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
    setValue('');
    setCurrentTitle(null);
  };

  // Переключить на существующий чат в истории
  const handleClickTitle = (title) => {
    setValue('');
    setCurrentTitle(title);
  };

  // Запрос контекста
  const getContext = async () => {
    try {
      const response = await fetch(
        `${API_HOST}/question?` +
        new URLSearchParams({ q: value, source }).toString()
      );
      const data = await response.json();
      return {
        prompt: data.prompt,
        sources: data.sources,
      };
    } catch (error) {
      console.error(error);
      return { prompt: '', sources: [] };
    }
  };

  // Отправка сообщения
  const getMessages = async () => {
    if (!value.trim()) return;
    setLoading(true);

    // Если нет текущего заголовка — создаём его
    if (!currentTitle) {
      setCurrentTitle(value);
    }

    // Добавляем в историю сообщение от пользователя
    setPreviousChats((prev) => [
      ...prev,
      {
        title: currentTitle || value,
        role: 'user',
        source,
        content: value,
      },
    ]);
    setValue('');

    // Получаем контекст для поиска
    const context = await getContext();
    const haveSources = context.sources && context.sources.length > 0;

    // Если источников нет — ответим коротко и выйдем
    if (!haveSources) {
      setPreviousChats((prev) => [
        ...prev,
        {
          title: currentTitle || value,
          role: 'assistant',
          source,
          content: 'Не удалось найти информацию по вашему вопросу.',
        },
      ]);
      setLoading(false);
      return;
    }

    const sourcesString =
      '\n\n**Источники:**\n\n' +
      context.sources
        .map(
          (src) =>
            `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;![pdf](/description.png) [${src.name}](${src.link})`
        )
        .join('\n\n');


    try {
      const lmstudio = createOpenAICompatible({
        baseURL: `${LM_STUDIO_HOST}/v1`,
      });

      // Запускаем стриминг
      const { textStream } = await streamText({
        model: lmstudio(LM_STUDIO_DEFAULT_MODEL),
        prompt: context.prompt,
        onFinish: ({ text }) => {
          // Когда стрим полностью закончится — снимаем флаг и
          // обновляем последнее «assistant»-сообщение, добавив итоговый контент:
          setLoading(false);
          setPreviousChats((prev) => {
            if (!prev.length) return prev;
            const updated = [...prev];
            // Находим последнее добавленное ассистентом сообщение
            // (или просто берём самый конец, если уверены, что он точно там):
            const lastIndex = updated.length - 1;
            // Обновляем его, добавляя получившийся контент:
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: text+sourcesString,
            };
            return updated;
          });
        },
      });

      // Формируем строку с источниками
      // Добавляем «assistant»-сообщение со стримом (без content),
      // контент у него дополнится, когда сработает onFinish.
      setPreviousChats((prev) => [
        ...prev,
        {
          title: currentTitle || value,
          role: 'assistant',
          source,
          stream: textStream,
          sourcesString,
          // Пока content нет (он "будет" стримиться)
        },
      ]);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Синхронизируем в localStorage
  useEffect(() => {
    localStorage.setItem('previousChats', JSON.stringify(previousChats));
    localStorage.setItem('currentTitle', JSON.stringify(currentTitle));
  }, [previousChats, currentTitle]);

  // При смене чата — восстанавливаем source (если есть)
  useEffect(() => {
    const chats = previousChats.filter((ch) => ch.title === currentTitle);
    const currentSource = chats?.slice(-1)[0]?.source;
    if (currentSource) {
      setSource(currentSource);
    }
  }, [currentTitle, previousChats]);

  // Сообщения только для выбранного чата
  const currentChat = previousChats.filter((ch) => ch.title === currentTitle);

  // Уникальные заголовки
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
