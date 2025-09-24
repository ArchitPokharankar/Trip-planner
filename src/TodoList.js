import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function TodoList() {
  const [user, setUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDateTime, setNewTodoDateTime] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Ask for Notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Listen for user auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        setTodos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch todos from Firestore
  useEffect(() => {
    if (user) {
      const q = query(collection(db, "users", user.uid, "todos"), orderBy("createdAt", "desc"));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const todosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTodos(todosData);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  // Add new todo
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodoText.trim() || !user) return;

    await addDoc(collection(db, "users", user.uid, "todos"), {
      text: newTodoText.trim(),
      completed: false,
      reminderDateTime: newTodoDateTime, // Store both date and time
      createdAt: serverTimestamp(),
    });

    setNewTodoText('');
    setNewTodoDateTime('');
  };

  // Toggle complete
  const toggleTodo = async (id, currentStatus) => {
    if (!user) return;
    const todoRef = doc(db, "users", user.uid, "todos", id);
    await updateDoc(todoRef, {
      completed: !currentStatus,
    });
  };

  // Delete
  const deleteTodo = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "todos", id));
  };

  // Reminder Notifications
  useEffect(() => {
    const timers = [];

    todos.forEach(todo => {
      if (todo.reminderDateTime && !todo.completed) {
        const reminderTime = new Date(todo.reminderDateTime).getTime();
        const now = Date.now();

        if (reminderTime > now) {
          const timeoutId = setTimeout(() => {
            if (Notification.permission === "granted") {
              new Notification("Travel Reminder", {
                body: todo.text,
                icon: "/favicon.ico",
              });
            }
          }, reminderTime - now);

          timers.push(timeoutId);
        }
      }
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [todos]);

  return (
    <div style={styles.page}>
      <div style={styles.diaryContainer}>
        
        {/* Back Button Outside Header */}
        <div style={styles.topBar}>
          <button style={styles.backButton} onClick={() => navigate('/')}>
            &larr; Back
          </button>
        </div>

        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>My Travel To-Do List</h1>
          <p style={styles.subtitle}>Keep track of your pre-travel tasks.</p>
        </div>

        {/* Form */}
        <form onSubmit={addTodo} style={styles.form}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="e.g., Buy travel insurance"
            style={styles.textInput}
          />
          <div style={styles.reminderContainer}>
            <label style={styles.reminderLabel}>Reminder:</label>
            <input
              type="datetime-local"
              value={newTodoDateTime}
              onChange={(e) => setNewTodoDateTime(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <button type="submit" style={styles.addButton}>Add Task</button>
        </form>

        {/* List */}
        <div style={styles.todoList}>
          {loading && <p>Loading your list...</p>}
          {!loading && todos.length === 0 && (
            <p style={styles.emptyMessage}>Your to-do list is empty. Add a task to get started!</p>
          )}
          {todos.map(todo => (
            <div key={todo.id} style={styles.todoItem}>
              <div style={styles.checkboxContainer} onClick={() => toggleTodo(todo.id, todo.completed)}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  readOnly
                  style={styles.checkbox}
                />
              </div>
              <div style={styles.todoTextContainer}>
                <p style={{
                  ...styles.todoText,
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  color: todo.completed ? '#aaa' : '#333'
                }}>
                  {todo.text}
                </p>
                {todo.reminderDateTime && (
                  <span style={styles.reminderDate}>
                    Reminder: {new Date(todo.reminderDateTime).toLocaleString()}
                  </span>
                )}
              </div>
              <button onClick={() => deleteTodo(todo.id)} style={styles.deleteButton}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const styles = {
  page: {
    background: '#f4f1ea',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "'Georgia', serif",
  },
  diaryContainer: {
    width: '100%',
    maxWidth: '800px',
    background: '#fdfaf5',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    padding: '30px 40px',
    border: '1px solid #ddd8cf',
    position: 'relative',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '15px',
  },
  backButton: {
    background: '#5a4a42',
    color: 'white',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  header: {
    textAlign: 'center',
    borderBottom: '2px solid #e0d8cd',
    paddingBottom: '20px',
    marginBottom: '30px',
  },
  title: {
    fontFamily: "'Brush Script MT', cursive",
    fontSize: '48px',
    margin: '0',
    color: '#5a4a42',
  },
  subtitle: {
    margin: '5px 0 0 0',
    color: '#7a6a62',
    fontSize: '16px',
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    marginBottom: '30px',
    alignItems: 'center',
  },
  textInput: {
    flex: '1 1 300px',
    padding: '12px',
    border: '1px solid #ddd8cf',
    borderRadius: '6px',
    fontSize: '16px',
    background: '#fff',
  },
  reminderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  reminderLabel: {
    fontSize: '14px',
    color: '#7a6a62',
  },
  dateInput: {
    padding: '10px',
    border: '1px solid #ddd8cf',
    borderRadius: '6px',
    fontSize: '14px',
  },
  addButton: {
    padding: '12px 20px',
    background: '#5a4a42',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  todoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#7a6a62',
    padding: '20px',
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    background: 'rgba(0,0,0,0.02)',
    borderLeft: '4px solid #c9bba7',
    borderRadius: '4px',
  },
  checkboxContainer: {
    cursor: 'pointer',
    padding: '5px',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    pointerEvents: 'none',
  },
  todoTextContainer: {
    marginLeft: '15px',
    flex: 1,
  },
  todoText: {
    margin: 0,
    fontSize: '18px',
  },
  reminderDate: {
    fontSize: '12px',
    color: '#a08d82',
    marginTop: '4px',
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    color: '#c9bba7',
    fontSize: '24px',
    cursor: 'pointer',
    fontWeight: 'bold',
  }
};
