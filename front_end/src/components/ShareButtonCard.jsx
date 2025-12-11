import { useState } from "react";
import "../style/ShareButtonCard.css";
import { FaShareAlt, FaWhatsapp, FaTwitter, FaEnvelope, FaLink } from "react-icons/fa";

export default function ShareButtonCard({ message }) {
  const [open, setOpen] = useState(false);

  const shareMessage =
    message ||
    `Hey! 😃 I just got this amazing movie recommendation!`;


  const shareOptions = [
    {
      name: "Copy",
      icon: <FaLink />,
      action: () => {
        navigator.clipboard.writeText(shareMessage);
        alert("Copied to clipboard! 📋");
      },
    },
    {
      name: "Email",
      icon: <FaEnvelope />,
      action: () => {
        window.open(
          `mailto:?subject=Movie Recommendation!&body=${encodeURIComponent(
            shareMessage
          )}`
        );
      },
    },
    {
      name: "WhatsApp",
      icon: <FaWhatsapp />,
      action: () => {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
          "_blank"
        );
      },
    },
    {
      name: "Twitter",
      icon: <FaTwitter />,
      action: () => {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareMessage
          )}`,
          "_blank"
        );
      },
    },
  ];

  return (
    <div className="share-container">
      <button className="share-main-btn" onClick={() => setOpen(!open)}>
        <FaShareAlt size={18} />
      </button>

      <div className={`share-card ${open ? "open" : ""}`}>
        {shareOptions.map((opt) => (
          <button
            key={opt.name}
            className="share-option-btn"
            onClick={opt.action}
            title={opt.name}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  );
}