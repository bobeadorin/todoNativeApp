import { useState, useEffect, useRef } from "react";
import "./App.css";
import ListItem from "./components/ListItem";

function App() {
  const [isClosing, setIsClosing] = useState(false);
  const [list, setList] = useState<string[]>(["item1", "item2", "item3"]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ipc = window.ipcRenderer;

    if (ipc) {
      ipc.on("animate-open", () => {
        setIsClosing(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      });

      ipc.on("animate-close", () => {
        setIsClosing(true);
      });
    }
  }, []);

  const handleAddItem = () => {
    if (!inputValue.trim()) return;
    setList((prev) => [...prev, inputValue.trim()]);
    setInputValue("");
  };

  const handleUpdateItem = (index: number, newText: string) => {
    setList((prev) => prev.map((item, i) => (i === index ? newText : item)));
  };

  const handleDeleteItem = (index: number) => {
    setList((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`popup-container ${isClosing ? "slide-down" : "slide-up"}`}>
      <div className="popup-content">
        <h2>To DO</h2>
        
        {/* Input & Plus Button Container */}
        <div className="todo-input-container">
          <input 
            ref={inputRef}
            autoFocus
            className="todo-input"
            value={inputValue}
            onChange={(e) => {
              
            console.log(e.target.value)
              setInputValue(e.target.value)}}
            placeholder="Add a new task..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <button className="add-btn" onClick={handleAddItem} title="Add Item">
            +
          </button>
        </div>

        {/* List mapping */}
        <div className="list-container">
          {list.map((item, index) => (
            <ListItem 
              key={index}
              id={index}
              textInput={item}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;