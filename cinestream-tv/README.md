# 🎬 CineStream TV — Plataforma Completa de Streaming & IPTV

Uma plataforma moderna de streaming inspirada no Saimo TV, com suporte completo para **Canais Ao Vivo**, **Filmes**, **Séries** e **Jogos de Futebol ao Vivo**, construída com **React 19**, **Vite**, **HLS.js** e design cinematográfico com estética dark, glassmorphism e efeitos neon.

---

## ✨ Principais Funcionalidades

### 📺 1. Canais Ao Vivo no Formato IPTV Console (Lista A-Z + TV no Centro)
- **Lista lateral com 408 canais em ordem alfabética (A-Z)**, com busca instantânea e filtro por categorias (Esportes, Abertos, Filmes, Notícias, etc.).
- **TV no centro já rodando imediatamente**: ao entrar na aba ou clicar em qualquer canal da lista, a transmissão ao vivo começa instantaneamente na tela principal central.
- **Múltiplos servidores por canal**: cada canal possui de 3 a 12 servidores de contingência (FHD, HD e SD).
- **Failover automático**: se uma fonte falhar ou apresentar oscilação, o player tenta automaticamente o próximo servidor.
- **Seletor de servidores em tempo real**: botões de pílulas logo abaixo da TV para alternar entre os servidores de transmissão com um clique.
- **Equalizador animado**: indicador visual na lista lateral mostrando exatamente qual canal está sendo transmitido ao vivo.

### 🎥 2. Catálogo VOD de Filmes (Mais de 30.000 títulos)
- Integração com `https://filmes-saimo.pages.dev/` e servidores em Cloudflare R2 e IPTV de alta velocidade.
- Navegação alfabética completa de **#** até **Z**, com contagem de títulos em tempo real.
- Suporte a múltiplas versões de áudio (**Dublado** e **Legendado**).
- Integração com **TMDB API**: posters em alta definição, sinopses em português, ano de lançamento e nota da comunidade.

### 🍿 3. Catálogo VOD de Séries com Temporadas e Episódios
- Navegação alfabética de séries.
- Seleção de temporadas (Temporada 1, 2, 3...) e lista de episódios individuais.
- Botão "Próximo Episódio" no player para maratonar continuamente.

### ⚽ 4. Jogos do Dia & Campeonatos (API ESPN)
- Calendário de partidas de futebol em tempo real:
  - Brasileirão Série A e Série B
  - Copa do Brasil
  - Copa Libertadores e Copa Sul-Americana
  - UEFA Champions League
  - Premier League e ligas europeias
- Placar em tempo real, minutos de jogo e atalho direto para os canais de esportes (SporTV, ESPN, Premiere, TNT, CazéTV).

### 🔍 5. Busca Global Instantânea (Atalho `Ctrl + K`)
- Pesquisa rápida entre mais de **40.000 títulos de filmes, séries e 408 canais**.
- Abas de filtros ("Todos", "Canais", "Filmes", "Séries").
- Busca em tempo real com debounce otimizado.

### ⭐ 6. Sistema de Favoritos e Histórico
- Salve canais, filmes e séries favoritos salvos no `localStorage`.
- "Continuar Assistindo": retoma o filme ou episódio de onde você parou.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js instalado (v18+)

### 1. Entrar na pasta do projeto
```bash
cd d:\PROJETOS_GITHOUB\cinestream-tv
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse no seu navegador: `http://localhost:5173/`

### 4. Gerar build de produção
```bash
npm run build
```

---

## 📁 Estrutura do Projeto

```
cinestream-tv/
├── index.html                   # HTML base com fontes Inter & Outfit e meta no-referrer
├── package.json                 # Dependências (React 19, Vite, HLS.js, Lucide Icons)
├── src/
│   ├── main.jsx                 # Entrada da aplicação React
│   ├── App.jsx                  # Componente principal, abas e coordenação
│   ├── index.css                # Sistema de design (tokens, cores, glassmorphism, animações)
│   ├── App.css                  # Estilos dos componentes, grids responsivos e player
│   ├── services/
│   │   ├── channelsService.js   # Parser e cache de canais ao vivo (408 canais)
│   │   ├── vodService.js        # Parser de filmes, séries, episódios e busca de 40k títulos
│   │   ├── tmdbService.js       # Metadados, posters e notas em pt-BR via TMDB
│   │   ├── sportsService.js     # Partidas ao vivo e placares via API da ESPN
│   │   └── storageService.js    # Favoritos, progresso de vídeo e configurações
│   └── components/
│       ├── Navbar.jsx           # Cabeçalho com logo, abas e gatilho de busca
│       ├── HeroBanner.jsx       # Destaque principal com backdrop cinematográfico
│       ├── ChannelCard.jsx      # Card de canal de TV com logo, qualidade e status
│       ├── MediaCard.jsx        # Card de filme/série com poster TMDB e nota
│       ├── VideoPlayer.jsx      # Player avançado HLS/MP4 com failover e controles
│       ├── MediaModal.jsx       # Modal de detalhes com sinopse e seleção de episódios
│       ├── AlphabetNav.jsx      # Navegação alfabética A-Z com contadores
│       ├── SportsSection.jsx    # Painel de jogos do dia e placares da ESPN
│       └── GlobalSearchModal.jsx # Modal de pesquisa instantânea (Ctrl + K)
```
