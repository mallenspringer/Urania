import React, { useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import type { RingNode } from "../types/project";

interface DeleteLayerModalProps {
  ring: RingNode;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}

export const DeleteLayerModal: React.FC<DeleteLayerModalProps> = ({
  ring,
  onConfirm,
  onCancel,
}) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  return (
    <div className="modal-backdrop" style={{ zIndex: 2000 }}>
      <div
        className="delete-layer-modal-card"
        style={{
          width: "90%",
          maxWidth: "440px",
          backgroundColor: "#12131a",
          border: "1px solid #232530",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6)",
          animation: "modalFadeIn 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                padding: "8px",
                borderRadius: "8px",
                display: "flex",
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
              Delete Ring Layer?
            </h3>
          </div>
          <button className="close-btn" onClick={onCancel} title="Close">
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5", margin: "0 0 16px 0" }}>
          Are you sure you want to delete <strong style={{ color: "#f1f5f9" }}>"{ring.name || "Ring Layer"}"</strong>? This will remove the ring layer and all sector graphics, text, shapes, and window cutouts placed on it.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#94a3b8",
            cursor: "pointer",
            marginBottom: "20px",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            style={{ accentColor: "#ef4444", cursor: "pointer" }}
          />
          <span>Don't show this warning again</span>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onConfirm(dontAskAgain)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <Trash2 size={14} />
            Delete Layer
          </button>
        </div>
      </div>
    </div>
  );
};
