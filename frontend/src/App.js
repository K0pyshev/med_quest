import React, { useState, useEffect, useRef } from 'react';
import { ReactComponent as Upward } from './icons/arrow_upward_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg';
import { streamText } from 'ai';
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";


import { Message } from './Message'; // <-- наш компонент с логикой стриминга


const LM_STUDIO_HOST = 'http://127.0.0.1:1234';
const LM_STUDIO_DEFAULT_MODEL = 'meta-llama-3.1-8b-instruct';
const API_HOST = 'http://127.0.0.1:8888';



// ------------------ Sidebar ------------------
const Sidebar = ({ uniqueTitles, onSelectTitle, onNewChat, onResetHistory, isClearing }) => {
  return (
    <div className="sidebar-wrapper">
      <div className="background-glow"></div>

      <section className="side-bar">
        <h1 className="Name">MedQuest</h1>
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
          <button
            className={`history-reset ${isClearing ? 'clearing' : ''}`}
            onClick={onResetHistory}
            disabled={isClearing}
          >
            Очистить историю
          </button>
        </nav>
      </section>
    </div>

  );
};
// ------------------ Header ------------------/
const Header = ({ source, onSourceChange }) => {
  const [open, setOpen] = useState(false);

  const sources = [
    { value: 'msd', label: 'MSD справочник' },
    { value: 'clinrec', label: 'Клинические рекомендации' },
    { value: 'rls', label: 'Энциклопедия РЛС2025' },
  ];

  const selected = sources.find((s) => s.value === source);

  return (
    <div className="main-header">
      <div className="source-selector">
        <button className="selector-toggle" onClick={() => setOpen(!open)}>
          {selected.label}
          <span className={`material-symbols-outlined arrow-icon ${open ? 'rotate' : ''}`}>
            arrow_forward_ios
          </span>
        </button>
        {open && (
          <ul className="selector-dropdown">
            {sources.map((src) => (
              <li
                key={src.value}
                className={`selector-option ${source === src.value ? 'active' : ''}`}
                onClick={() => {
                  onSourceChange(src.value);
                  setOpen(false);
                }}
              >
                {src.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ------------------ ChatFeed ------------------

const ChatFeed = ({ currentChat }) => {
  const feedRef = useRef(null);

  useEffect(() => {
    // При любом новом сообщении сразу скроллимся вниз (если нужно).
    if (!feedRef.current) return;
    feedRef.current.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: 'smooth',
    });
    console.log(currentChat)
  }, [currentChat]);

  return (
    <ul className="feed" ref={feedRef}>
      {currentChat?.map((msg, index) => (
        <Message
          key={index}
          {...msg}
          feedRef={feedRef}  // <-- ВАЖНО: передаем ref в Message
        />
      ))}
    </ul>
  );
}


// ------------------ MessageInput ------------------
const MessageInput = ({ value, onChange, onSend, loading}) => {
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
  const [isClearing, setIsClearing] = useState(false);

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

const [currentChat, setCurrentChat] = useState(() => {
  const savedChat = localStorage.getItem('currentChat');
  return savedChat ? JSON.parse(savedChat) : [];
});

  // Смена источника
  const handleSourceClick = (newSource) => {
    setSource(newSource);
  };

  // Создать новый чат
const createNewChat = () => {
  setValue('');
  setCurrentTitle(null);
  setCurrentChat([]); // Явная очистка текущего чата
};

  // Переключить на существующий чат в истории
const handleClickTitle = (title) => {
  setValue('');
  setCurrentTitle(title);
  
  // Явное обновление текущего чата
  const chats = previousChats.filter((ch) => ch.title === title);
  setCurrentChat(chats);
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

    // Если нет текущего заголовка — создаём его (будущий title)
    let newTitle = currentTitle;
    if (!newTitle) {
      newTitle = value;
      setCurrentTitle(newTitle);
    }

    // 1. Получаем «контекст» из API (например, с помощью getContext)
    const context = await getContext();
    const haveSources = context.sources && context.sources.length > 0;

    // 2. Формируем новое сообщение пользователя
    const userMessage = {
      title: newTitle,
      role: 'user',
      source,
      content: `<!-- Контекст:${context.prompt.trim()}\n\n Вопрос: -->\n\n${value}`,
    };

    // Сохраняем это новое сообщение в history
setPreviousChats((prev) => {
  const newChats = [...prev, userMessage];
  // Автоматическое обновление текущего чата
  if (userMessage.title === currentTitle) {
    setCurrentChat(newChats.filter(ch => ch.title === currentTitle));
  }
  return newChats;
});
    // Очищаем input
    setValue('');

    // Если источников нет — можно вывести короткий ответ и завершить
    if (!haveSources) {
      setPreviousChats((prev) => [
        ...prev,
        {
          title: newTitle,
          role: 'assistant',
          source,
          content: 'Не удалось найти информацию по вашему вопросу.',
        },
      ]);
      setLoading(false);
      return;
    }

    // 3. Формируем массив «всех реплик» для отправки в модель
    //    Берём все сообщения из текущего чата + новое сообщение пользователя
    //    (учитывая, что setPreviousChats — асинхронный, работаем с «предыдущим состоянием» напрямую)
    const conversationSoFar = previousChats
      .filter((msg) => msg.title === newTitle)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    console.log(conversationSoFar)
    // Добавляем в конец текущее (только что созданное) сообщение пользователя
    conversationSoFar.push({
      role: userMessage.role,
      content: userMessage.content,
    });
    // Сформируем строку с источниками (вы сможете вывести её в конце ответа)
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

      // 4. Запускаем стриминг, передавая всю историю
      const { textStream } = await streamText({
        model: lmstudio(LM_STUDIO_DEFAULT_MODEL),
        messages: conversationSoFar,
        // onFinish срабатывает, когда поток полностью завершён
        onFinish: ({ text }) => {
          setLoading(false);
          // Дополняем последнее сообщение ассистента финальным контентом
          setPreviousChats((prev) => {
            const updated = [...prev];
            // Ищем последнее добавленное сообщение "assistant"
            const lastIndex = updated
              .map((m) => m.role)
              .lastIndexOf('assistant');
            if (lastIndex > -1) {
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: text + sourcesString,
              };
            }
            return updated;
          });
        },
      });

      // Пока идёт стрим — добавляем ассистента с «пустым» контентом
      // (он будет наполняться за счёт textStream)
      setPreviousChats((prev) => [
        ...prev,
        {
          title: newTitle,
          role: 'assistant',
          source,
          stream: textStream, // сам поток
          sourcesString,      // сохраняем, чтобы добавить в конце
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
  localStorage.setItem('currentChat', JSON.stringify(currentChat));
}, [previousChats, currentTitle, currentChat]);

  // При смене чата — восстанавливаем source (если есть)
useEffect(() => {
  if (!currentTitle) {
    setCurrentChat([]);
    return;
  }
  
  const chats = previousChats.filter((ch) => ch.title === currentTitle);
  setCurrentChat(chats);
  
  if (chats.length > 0) {
    const lastSource = chats[chats.length - 1].source;
    setSource(lastSource);
  }
}, [currentTitle, previousChats]);

  // Функция очистки истории
  const handleResetHistory = () => {
    setIsClearing(true);
    setTimeout(() => {
      setPreviousChats([]);
      setCurrentTitle(null);
      localStorage.removeItem('previousChats');
      localStorage.removeItem('currentTitle');
      setIsClearing(false);
    }, 500); // Должно совпадать с длительностью анимации
  };

  // Сообщения только для выбранного чата


  // Уникальные заголовки
  const uniqueTitles = Array.from(new Set(previousChats.map((ch) => ch.title)));

  return (
    <div className="App">
      <Sidebar
        uniqueTitles={uniqueTitles}
        onSelectTitle={handleClickTitle}
        onNewChat={createNewChat}
        onResetHistory={handleResetHistory}
        isClearing={isClearing}
      />
      <div className="mainElemets">
        <Header source={source} onSourceChange={handleSourceClick} />
        <section className="main">
          <ChatFeed key={currentTitle} currentChat={currentChat} />
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
