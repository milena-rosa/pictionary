// WordSelectionModal.tsx
import React from "react";

interface WordSelectionModalProps {
  words: string[];
  onSelectWord: (word: string) => void;
}

const WordSelectionModal: React.FC<WordSelectionModalProps> = ({
  words,
  onSelectWord,
}) => {
  if (!words || words.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-3xl p-8 max-w-md w-full text-center transform transition-all duration-300 scale-95 animate-modal-pop">
        <h2 className="text-2xl font-extrabold mb-4 text-gray-800 leading-tight">
          Choose Your Word! ✨
        </h2>
        <p className="text-base text-gray-600 mb-6">
          Select one of these words to draw for your teammates:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {words.map((word, index) => (
            <button
              key={index}
              onClick={() => onSelectWord(word)}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-3 px-6 rounded-full transition-all duration-300 text-lg shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 tracking-wide cursor-pointer"
            >
              {word}
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-gray-500 italic">
          Choose wisely! This word will challenge your drawing skills and your
          friends' guessing abilities!
        </p>
      </div>
    </div>
  );
};

export default WordSelectionModal;
