FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY public ./public
COPY src ./src
COPY tsconfig.json postcss.config.js tailwind.config.js ./
RUN npm run build

FROM nginx:alpine
COPY nginx/common-locations.conf /etc/nginx/common-locations.conf
COPY nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html/patr
EXPOSE 80 443
