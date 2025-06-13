# Pictionary Online

A real-time, multiplayer Pictionary game built with **React**, **TypeScript**, **Tailwind CSS** (frontend), and **FastAPI** (backend). Draw, guess, and compete with friends in your browser!

![pictionary screen](https://github.com/milena-rosa/pictionary/blob/main/image.jpeg)

---

## Features

- 🎨 **Real-time Drawing:** Draw on a shared canvas, with instant updates for all players.
- 🧑‍🤝‍🧑 **Multiplayer Rooms:** Create or join game rooms with unique IDs.
- 🏆 **Scoreboard:** Track player scores and see who's in the lead.
- 💬 **Game Chat:** Guess the word or chat with other players in real time.
- ⏰ **Round Timer:** Each round is timed for fast-paced fun.
- 🗝️ **Word Selection:** The drawer chooses from random word options each round.
- 📱 **Responsive UI:** Works great on desktop and mobile browsers.
- 🐾 **Categories:** Words are grouped into categories (animals, objects, actions, places, expressions).

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Python 3.10+](https://www.python.org/)
- [pip](https://pip.pypa.io/en/stable/)

---

### 1. Clone the Repository

```sh
git clone https://github.com/milena-rosa/pictionary.git
cd pictionary
```

---

### 2. Environment Variables

To configure environment variables for this project, follow these steps:

1. **Locate the `.env.example` file(s):**  
   Each `.env.example` file contains a list of required environment variables and example values. There is one in each of the `backend/` and `frontend/` folders.

2. **Create your own `.env` file(s):**  
   Copy the `.env.example` file and rename the copy to `.env` in the same directory. For example:

   ```sh
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Update the `.env` file(s):**  
   Open the newly created `.env` file(s) and update the values as needed for your local setup (e.g., API keys, ports, URLs, etc.).

   - **backend/.env**
     ```dotenv
     LOCALHOST=localhost
     PORT=8000
     FRONTEND_BUILD_DIR="../frontend/dist"
     FRONTEND_STATIC_DIR="assets"
     ```
   - **frontend/.env**
     ```dotenv
     VITE_WS_URL=ws://localhost:8000/ws
     ```

4. **Keep your `.env` files private:**  
   Do not commit `.env` files to version control. They may contain sensitive information.

> **Tip:** If new variables are added to `.env.example` in the future, repeat the steps above to update your `.env` file accordingly.

---

### 3. Install Backend Dependencies

```sh
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

### 4. Install Frontend Dependencies

```sh
cd ../frontend
npm install
```

---

### 5. Build the Frontend

```sh
npm run build
```

This will generate the production-ready frontend in `frontend/dist/`.

---

### 6. Run the Backend Server

```sh
cd ../backend
python3 main.py
```

- The backend will serve the frontend static files and provide the API and WebSocket endpoints.

---

### 7. Open the Game

Visit [http://localhost:8000](http://localhost:8000) in your browser.

---

## How to Play

1. **Create a Room:** Enter your name and click "Create Room". Share the Room ID with friends.
2. **Join a Room:** Enter your name and the Room ID to join an existing game.
3. **Start the Game:** The host can start the game when at least 2 players have joined.
4. **Draw & Guess:** The drawer selects a word and draws it. Others guess in the chat. Points are awarded for correct guesses!
5. **Rounds:** The drawer rotates each round. The game ends after the set number of rounds.

---

## Project Structure

- `backend/` — FastAPI server, game logic, WebSocket handling.
- `frontend/` — React app, UI components, game state management.

---

## Customization

- **Word Categories:** Edit the `word_lists` in [`backend/game_manager.py`](backend/game_manager.py) to add more words or categories.
- **Frontend Styling:** Tweak Tailwind CSS classes in the React components for a custom look.

---

## Troubleshooting

- If you see "Frontend build not found!", make sure you ran `npm run build` in the `frontend/` directory.
- For CORS or WebSocket issues, ensure both frontend and backend are running on the same host/port or configure as needed.

---

## License

MIT License

---

Enjoy playing Pictionary with your friends! 🎉
