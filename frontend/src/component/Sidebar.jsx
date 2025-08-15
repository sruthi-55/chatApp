import styles from "./Sidebar.module.css";
import ChatIcon from "../assets/icons/Chat.svg";
import InvitationIcon from "../assets/icons/invitation.svg";
import RoomIcon from "../assets/icons/room.svg";
import LogoutIcon from "../assets/icons/logout.svg";
import SettingsIcon from "../assets/icons/settings.svg";
import AllChatsIcon from "../assets/icons/allChats.svg";

export default function Sidebar({ user, setSelectedSection, style }) {
  return (
    <aside className={styles.sidebar} style={style}>
      <div className={styles.profileIcons}>
        <img
          src={user.avatar || "/defaultUserProfile.png"}
          alt="Avatar"
          className={styles.avatar}
          onClick={() => setSelectedSection("profile")}
        />
        <img src={AllChatsIcon} alt="All Chats" className={styles.icon} onClick={() => setSelectedSection("allChats")} />
        <img src={ChatIcon} alt="Chat" className={styles.icon} onClick={() => setSelectedSection("friendsChat")} />
        <img src={InvitationIcon} alt="Invitation" className={styles.icon} onClick={() => setSelectedSection("requests")} />
        <img src={RoomIcon} alt="Room" className={styles.icon} onClick={() => setSelectedSection("rooms")} />
      </div>
      <div className={styles.bottomIcons}>
        <img src={SettingsIcon} alt="Settings" className={styles.icon} />
        <img src={LogoutIcon} alt="Logout" className={styles.icon} />
      </div>
    </aside>
  );
}
