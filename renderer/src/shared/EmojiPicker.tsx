const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","😊","😇",
      "🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","🤗",
      "🤔","😬","😐","😑","😶","🙄","😏","😒","😞","😔",
      "😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭",
      "😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨",
      "😰","😥","😓","🤭","😎","🤩","🥳","😴","🤪","😜",
    ],
  },
  {
    label: "👍",
    emojis: [
      "👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉",
      "👆","👇","☝️","✋","🤚","🖐️","🖖","🙏","👏","🙌",
      "🤝","🤜","🤛","💪","🦾","✍️","🤳","💅","🤲","👐",
    ],
  },
  {
    label: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
      "🌹","🌸","🌺","🌻","🌼","💐","🌷","🥀",
    ],
  },
  {
    label: "🎮",
    emojis: [
      "🎮","🕹️","🎯","🎲","🎳","♟️","🏆","🥇","🥈","🥉",
      "🏅","🎖️","🚀","⭐","🌟","💫","✨","🔥","💥","⚡",
      "💎","👑","🎁","🎉","🎊","🎈","🎀","🌈","🌊","🌙",
    ],
  },
];

export default function EmojiPicker({
  onEmoji,
}: {
  onEmoji: (emoji: string) => void;
}) {
  return (
    <div
      className="emoji-picker"
      onClick={(e) => e.stopPropagation()}
    >
      {CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div className="emoji-category-label">{cat.label}</div>
          <div className="emoji-grid">
            {cat.emojis.map((em) => (
              <button
                key={em}
                className="emoji-btn"
                onClick={() => onEmoji(em)}
                title={em}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
