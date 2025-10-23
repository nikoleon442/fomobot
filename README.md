# FOMObot 🚀

**FOMObot** is a sophisticated token market cap monitoring service that tracks cryptocurrency tokens and sends Telegram alerts when they reach configurable milestone multiples (e.g., 2×, 5×, 10×) of their initial market cap.

## 🎯 Overview

FOMObot monitors two curated token lists (FSM and Issam groups) every 60 seconds, fetching market cap data and comparing it to initial values. When tokens cross predefined milestones, the service sends formatted Telegram notifications to the respective group chats.

### Key Features

- **🔄 Real-time Monitoring**: Polls every 60 seconds for market cap changes
- **📊 Multi-Provider Support**: CoinGecko, CoinMarketCap, Birdeye, and DexScreener
- **🎯 Dynamic Milestones**: Configurable milestone thresholds per group
- **🚫 Duplicate Prevention**: Tracks sent notifications to prevent spam
- **🏗️ Hexagonal Architecture**: Clean, testable, and maintainable codebase
- **📈 Health Monitoring**: Built-in health checks and statistics endpoints
- **🔧 Provider Agnostic**: Easy to switch between market data providers

## 🏗️ Architecture

FOMObot follows **Hexagonal Architecture** (Ports & Adapters) principles:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Domain Layer  │    │ Application     │    │   Interface     │
│                 │    │    Layer        │    │     Layer       │
│ • MilestonePolicy│    │ • Use Cases     │    │ • HTTP Controller│
│ • MessageBuilder│    │ • Orchestration │    │ • Scheduler     │
│ • Types         │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ports Layer   │    │   Adapters      │    │   Infrastructure│
│                 │    │     Layer       │    │                 │
│ • MarketCapPort │    │ • CoinGecko    │    │ • Supabase      │
│ • TokenRepoPort │    │ • CMC Adapter  │    │ • Telegram     │
│ • NotifierPort  │    │ • Birdeye      │    │ • Railway       │
│ • ClockPort     │    │ • DexScreener  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

- **Domain Layer**: Pure business logic (milestone evaluation, message building)
- **Application Layer**: Use cases orchestrating the business flow
- **Ports Layer**: Abstract interfaces for external dependencies
- **Adapters Layer**: Concrete implementations of external services
- **Interface Layer**: HTTP endpoints and scheduled tasks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Telegram Bot Token
- Market data provider API keys (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fomobot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## ⚙️ Configuration

### Environment Variables

```bash
# Polling Configuration
POLL_INTERVAL_SECONDS=60

# Provider Selection
MARKET_CAP_PROVIDER=dexscreener  # coingecko, cmc, birdeye, dexscreener

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_TABLE_FSM=tokens_fsm
SUPABASE_TABLE_ISSAM=tokens_issam

# Telegram Configuration
TG_BOT_TOKEN=your_bot_token
TG_CHAT_ID_FSM=your_fsm_chat_id
TG_CHAT_ID_ISSAM=your_issam_chat_id

# Optional API Keys
CMC_API_KEY=your_cmc_key
BIRDEYE_API_KEY=your_birdeye_key

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Database Schema

The service uses four main Supabase tables:

1. **`tokens_fsm`** - FSM group tokens (read-only)
2. **`tokens_issam`** - Issam group tokens (read-only)
3. **`milestones_config`** - Dynamic milestone configuration (read-write)
4. **`milestone_notifications`** - Notification tracking (write-only)

See `setup-database.sql` for complete schema definition.

## 📊 API Endpoints

### Health Check
```http
GET /health
```
Returns service health status, uptime, and current statistics.

### Statistics
```http
GET /stats
```
Returns current polling cycle statistics.

### Manual Trigger
```http
POST /trigger
```
Manually triggers a polling cycle (useful for testing).

### Root
```http
GET /
```
Returns service information and version.

## 🔄 How It Works

### Polling Cycle

1. **Token Retrieval**: Fetches all tokens from both FSM and Issam groups
2. **Milestone Loading**: Loads active milestone configurations per group
3. **Market Data**: Fetches current market cap data from selected provider
4. **Milestone Evaluation**: Compares current vs initial market cap ratios
5. **Notification Check**: Verifies if milestone was already notified
6. **Alert Sending**: Sends Telegram message if milestone crossed
7. **Persistence**: Records notification to prevent duplicates

### Message Format

```
🚨 *TOKEN* hit *MILESTONE* market cap since call-out!
Initial MC: $1.2M
Current MC: $3.6M
Called: 2024-01-15T10:30:00Z
⏫ Still moving — watch closely.
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Test Structure

- **Unit Tests**: Domain logic, use cases, and adapters
- **Integration Tests**: External service integrations
- **E2E Tests**: Full application flow testing

## 🚀 Deployment

### Railway Deployment

The service is configured for automatic deployment to Railway:

1. **Set up Railway project**
2. **Configure environment variables** in Railway dashboard
3. **Deploy via GitHub Actions** (automatic on push to main)

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

## 📈 Monitoring

### Health Checks

- **Provider Health**: Market data provider connectivity
- **Database Health**: Supabase connection status
- **Notifier Health**: Telegram API connectivity
- **Cycle Performance**: Polling cycle duration monitoring

### Metrics

- **Processed Tokens**: Number of tokens processed per cycle
- **Alerts Sent**: Number of milestone notifications sent
- **Skipped Tokens**: Tokens with missing market data
- **Errors**: Failed operations count

## 🔧 Development

### Project Structure

```
src/
├── domain/           # Business logic
├── application/       # Use cases
├── ports/           # Abstract interfaces
├── adapters/        # External service implementations
│   ├── providers/   # Market data providers
│   ├── persistence/ # Database adapters
│   ├── notifier/   # Telegram adapter
│   └── system/     # System utilities
└── interface/       # HTTP controllers and schedulers
```

### Adding New Providers

1. Create adapter implementing `MarketCapProviderPort`
2. Add to `MarketCapProviderFactory`
3. Update environment configuration
4. Add tests

### Adding New Features

1. Define domain types in `domain/types.ts`
2. Implement business logic in domain layer
3. Create use case in application layer
4. Add interface in ports layer
5. Implement adapter
6. Add tests

## 🛠️ Troubleshooting

### Common Issues

1. **Missing Market Data**: Check provider API keys and rate limits
2. **Telegram Errors**: Verify bot token and chat IDs
3. **Database Connection**: Check Supabase credentials
4. **High Memory Usage**: Monitor polling cycle performance

### Debugging

```bash
# Enable debug logging
NODE_ENV=development npm run start:dev

# Check logs
docker logs <container-id>
```

## 📝 License

This project is licensed under the UNLICENSED license.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the technical documentation

---

**FOMObot** - Never miss a moon again! 🌙🚀