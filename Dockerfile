FROM node:20

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY rollup.config.js ./
COPY jest.config.js ./

COPY src ./src
COPY test ./test

RUN npm ci

RUN npm run build

CMD ["npm", "test"]
