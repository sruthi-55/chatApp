import { useState } from "react";
import api from "../api/axios";
import styles from "./Register.module.css";
import { useNavigate } from "react-router-dom";

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

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/auth/register", formData);
      navigate("/api/homepage");
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
