FROM golang:1.23-alpine AS build
RUN sed -i 's|dl-cdn.alpinelinux.org|mirror.yandex.ru|g' /etc/apk/repositories
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM alpine:3.20
RUN sed -i 's|dl-cdn.alpinelinux.org|mirror.yandex.ru|g' /etc/apk/repositories \
    && apk add --no-cache ca-certificates wget tzdata \
    && adduser -D -u 1000 app
COPY --from=build /server /usr/local/bin/server
USER app
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/server"]
