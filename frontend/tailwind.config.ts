export default {
  theme: {
    extend: {
      boxShadow: {
        "3xl": "0 20px 50px rgba(0, 0, 0, 0.15)", // Custom shadow for modals
      },
      keyframes: {
        "modal-pop": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        bounce: {
          // Added for the Scoreboard icon
          "0%, 100%": {
            transform: "translateY(-25%)",
            animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
          },
          "50%": {
            transform: "none",
            animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
          },
        },
      },
      animation: {
        "modal-pop": "modal-pop 0.3s ease-out forwards",
        bounce: "bounce 1s infinite", // Use `animate-bounce` in classes
      },
    },
  },
  plugins: [],
};
