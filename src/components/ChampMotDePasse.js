"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function ChampMotDePasse({ id, label, valeur, onChange, autoComplete = "current-password" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="champ">
      <label htmlFor={id}>{label}</label>
      <div className="saisie-mdp">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="saisie"
          required
          value={valeur}
          onChange={onChange}
          autoComplete={autoComplete}
        />
        <button type="button" className="oeil"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
