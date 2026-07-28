package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const maxUploadBytes = 5 << 20 // 5 MB

func extFromContentType(ct string) string {
	switch ct {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ""
	}
}

// AdminUpload accepts a multipart image upload ("file"), validates it is an
// image under the size limit, stores it with a random name, and returns its
// public URL under /api/uploads/. Admin-authenticated.
func AdminUpload(dir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+4096)
		if err := r.ParseMultipartForm(maxUploadBytes + 4096); err != nil {
			writeError(w, http.StatusBadRequest, "файл слишком большой (макс 5 МБ)")
			return
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "файл не найден")
			return
		}
		defer file.Close()

		head := make([]byte, 512)
		n, _ := io.ReadFull(file, head)
		ext := extFromContentType(http.DetectContentType(head[:n]))
		if ext == "" {
			writeError(w, http.StatusBadRequest, "только изображения: jpg, png, webp, gif")
			return
		}
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			writeError(w, http.StatusInternalServerError, "ошибка чтения файла")
			return
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			writeError(w, http.StatusInternalServerError, "хранилище недоступно")
			return
		}
		raw := make([]byte, 16)
		if _, err := rand.Read(raw); err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		name := hex.EncodeToString(raw) + ext
		dst, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "не удалось сохранить файл")
			return
		}
		defer dst.Close()
		if _, err := io.Copy(dst, io.LimitReader(file, maxUploadBytes)); err != nil {
			writeError(w, http.StatusInternalServerError, "не удалось сохранить файл")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"url": "/api/uploads/" + name})
	}
}

// ServeUpload serves a previously uploaded image. Public (menu photos are
// public). Filename is sanitised to prevent path traversal.
func ServeUpload(dir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := filepath.Base(r.PathValue("name"))
		if name == "." || name == string(filepath.Separator) || strings.Contains(name, "..") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		http.ServeFile(w, r, filepath.Join(dir, name))
	}
}
