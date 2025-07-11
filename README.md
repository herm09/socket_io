# Application de Chat en Temps Réel avec Interface Administrateur

Ce projet est une application de chat en ligne développée avec **Node.js**, **Express** et **Socket.IO**. Elle permet à des utilisateurs de rejoindre des salons de discussion, d’échanger des messages en temps réel. Elle permet également aux administrateurs d’avoir une vue en direct de tous les salons et de leurs utilisateurs connectés mais aussi de pouvoir supprimer les salons existants ainsi que les messages envoyés.

## Fonctionnalités

- Création de compte (pseudo + mot de passe)
- Connexion utilisateur et admin (pseudo + mot de passe)
- Échange de messages en temps réel via WebSocket (Socket.IO)
- Affichage du salon et des participants
- Interface d’administration protégée (connexion requise)
- Vue en temps réel de tous les salons et utilisateurs actifs
- Limitation de tentatives de connexion pour éviter les attaques bruteforce
- Session admin avec `express-session`

---

## Structure des dossiers
```
├── node_modules
├── public/ # Front‑end statique  
│ ├── admin.html # Dashboard admin (salons + utilisateurs)  
│ ├── chat.html # Interface de chat utilisateur  
│ ├── home_user.html # Interface des rooms users  
│ ├── index.html # Page de connexion 
├── .env # Variables d’environnement (identifiants admin)
├── server.js # Serveur Express + Socket.IO  
├── package.json  
├── README.md # Ce fichier  
├── rooms.json
├── server.js # Serveur Express + Socket.IO  
└── users.json 
```
---

## Prérequis

- Node.js version ≥ 14
- npm

---

## Installation

1. Cloner le dépôt :
    git clone https://github.com/herm09/socket_io.git
    cd socket_io

2. Initialiser le projet Node.JS :
    npm init -y

3. Installer les dépendances :
    npm install
    npm install express socket.io
    npm install dotenv

4. Créer le fichier .env à la racine du projet et configurer les identifiants administrateurs :
    ADMIN_USER=votre_user
    ADMIN_PASS=votre_mot_de_passe

## Exécuter le projet en local

node server.js

## Déploiement Render :

Aller sur le lien ci-après : https://socket-chat-av6h.onrender.com/