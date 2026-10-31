import { useState } from "react";
import { Pencil, Check, Trash2, X } from "lucide-react";
import "./ListItemStyles.css";

type ListItemProps = {
  id: number;
  textInput: string;
  onUpdate: (id: number, newText: string) => void;
  onDelete: (id: number) => void;
};

export default function ListItem({ id, textInput, onUpdate, onDelete }: ListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(textInput);
  const [isDone, setIsDone] = useState(false);

  const handleSave = () => {
    if (content.trim() !== "") {
      onUpdate(id, content);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setContent(textInput);
    setIsEditing(false);
  };

  return (
    <div className={`list-item-container ${isDone ? "completed" : ""}`}>
      {isEditing ? (
        <input
          type="text"
          className="list-item-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />
      ) : (
        <p className="list-item-content">{content}</p>
      )}

      <div className="list-item-action-btns">
        {isEditing ? (
          <>
            <button onClick={handleSave} className="icon-btn save" title="Save">
              <Check size={16} />
            </button>
            <button onClick={handleCancel} className="icon-btn cancel" title="Cancel">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} className="icon-btn edit" title="Edit">
              <Pencil size={16} />
            </button>
            <button onClick={() => setIsDone(!isDone)} className={`icon-btn done ${isDone ? "active" : ""}`} title={isDone ? "Undo" : "Done"}>
              <Check size={16} />
            </button>
            <button onClick={() => onDelete(id)} className="icon-btn delete" title="Delete">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}