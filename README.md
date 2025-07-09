# 💬 Application de Chat en Temps Réel avec Interface Administrateur

Ce projet est une application de chat en ligne développée avec **Node.js**, **Express** et **Socket.IO**. Elle permet à des utilisateurs de rejoindre des salons de discussion, d’échanger des messages en temps réel, et à un administrateur d’avoir une vue en direct de tous les salons et de leurs utilisateurs connectés.

## 🚀 Fonctionnalités

- Connexion utilisateur (pseudo + salon)
- Échange de messages en temps réel via WebSocket (Socket.IO)
- Affichage du salon et des participants
- Interface d’administration protégée (connexion requise)
- Vue en temps réel de tous les salons et utilisateurs actifs
- Limitation de tentatives de connexion pour éviter les attaques bruteforce

---

## 📁 Structure des dossiers

├── public/ # Fichiers statiques (HTML, CSS, JS)
│ ├── chat.html
│ ├── admin.html
│ ├── admin_login.html
│ ├── index.html
├── .env # Identifiants admin
├── server.js # Serveur Express + Socket.IO
├── package.json


---

## 🔧 Prérequis

- Node.js ≥ 14
- npm

---

## 🛠️ Installation

1. Clone ce dépôt :
   git clone https://github.com/herm09/socket_io.git

2. Initialiser le projet Node.JS :
  npm init -y

3. Installer les dépendances :
    npm install
    npm install express socket.io
    npm install dotenv

4. Configurer les identifiants administrateurs dans le .env :
  ADMIN_USER=votre_user
  ADMIN_PASS=votre_mot_de_passe

## Lancer le projet

node server.js