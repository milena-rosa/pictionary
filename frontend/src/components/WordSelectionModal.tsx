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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Choose Your Word!
        </h2>
        <p className="text-gray-600 mb-6">Select one of these words to draw:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {words.map((word, index) => (
            <button
              key={index}
              onClick={() => onSelectWord(word)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-lg shadow-md"
            >
              {word}
            </button>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Choose wisely! Other players will guess this word.
        </p>
      </div>
    </div>
  );
};

export default WordSelectionModal;
