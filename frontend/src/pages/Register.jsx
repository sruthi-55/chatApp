import { useState } from "react";
import api from "../api/axios";
import styles from "./Register.module.css";
import { useNavigate } from "react-router-dom";

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload?expiration=600&key=593c041e2f0d256ad0ea8a31d3992636";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    avatar: "/defaultUserProfile.png",
    username: "",
    email: "",
    full_name: "",
    phone: "",
    bio: "",
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  function handleReset() {
    setFormData({
      usernameOrEmail: "",
      password: "",
    });
    setError("");
  }

  async function downscaleToDataURL(file, maxW = 512, maxH = 512, quality = 0.85) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    await new Promise((r) => (img.onload = r));
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality); // smaller than PNG
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // If you don’t want downscaling, replace the next 2 lines with a FileReader to get the dataURL directly
    const dataUrl = await downscaleToDataURL(file);
    setFormData((prev) => ({ ...prev, avatar: dataUrl }));
  };

  async function uploadToImgbbFromDataUrl(dataUrl) {
    // imgbb expects just the raw base64, not the prefix
    const base64 = dataUrl.split(",")[1];
  const form = new FormData();
  form.append("image", base64);

  const res = await fetch(
    IMGBB_UPLOAD_URL,
    { method: "POST", body: form } // no headers, no credentials
  );
  if (!res.ok) throw new Error("ImgBB upload failed");
  const json = await res.json();
  const d = json?.data;
  return { imageUrl: d?.url || d?.display_url, deleteUrl: d?.delete_url };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    let avatarUrl = formData.avatar;

      // If the avatar is still a Data URL, upload it first
      if (avatarUrl.startsWith("data:")) {
        const { imageUrl } = await uploadToImgbbFromDataUrl(avatarUrl);
        if (!imageUrl) throw new Error("Image upload failed");
        avatarUrl = imageUrl;
      }

      const payload = { ...formData, avatar: avatarUrl };

    try {
      await api.post("/api/auth/register", payload);
      navigate("/api/auth/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles["container"]}>
      <h2 className={styles["title"]}>User Registration</h2>

      {error && <p className={styles["error-text"]}>{error}</p>}

      {/* Avatar + Name Row */}
      <div className={styles["form-group"]}>
        <div className={styles["avatar-name-row"]}>
          <label className={styles["avatar"]}>
            <img
              src={formData.avatar}
              alt="Avatar"
              className={styles["avatar-img"]}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
          </label>
          <div className={styles["name-fields"]}>
            <div className={styles["form-group"]}>
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles["form-group"]}>
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles["form-group"]}>
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles["form-group"]}>
        <label>Phone</label>
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
        />
      </div>

      <div className={styles["form-group"]}>
        <label>Bio</label>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}></textarea>
      </div>

      <div className={styles["form-group"]}>
        <label>Gender</label>
        <select name="gender" value={formData.gender} onChange={handleChange}>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className={styles["form-group"]}>
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles["form-group"]}>
        <label>Confirm Password</label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles["button-group"]}>
        <button type="submit" disabled={loading}>
          {loading ? "Registering in..." : "Register"}
        </button>
        <button
          type="reset"
          onClick={handleReset}
          className={styles["cancel-btn"]}>
          Cancel
        </button>
      </div>
    </form>
  );
}
