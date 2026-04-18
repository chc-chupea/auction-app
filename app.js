import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore, doc, setDoc, getDoc,
  updateDoc, onSnapshot, runTransaction,
  collection, addDoc, getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const auctionId = localStorage.getItem("auctionId") || "main";

let currentUser = null;
let pendingPrice = 0;
let currentPrice = 0;

// =======================
// 登録
// =======================
window.register = async () => {
  try {
    const name = document.getElementById("name").value;
    const nickname = document.getElementById("nickname").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      nickname,
      email,
      isAdmin: false
    });

    document.getElementById("msg").innerText = "登録完了";
  } catch (e) {
    console.error(e);
    document.getElementById("msg").innerText = "登録エラー";
  }
};

// =======================
// ログイン
// =======================
window.login = async () => {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    await signInWithEmailAndPassword(auth, email, password);

    location.href = "auction.html";
  } catch (e) {
    console.error(e);
    document.getElementById("msg").innerText = "ログイン失敗";
  }
};

// =======================
// 認証後処理
// =======================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  currentUser = snap.data();

  const ref = doc(db, "auctions", auctionId);

  onSnapshot(ref, (s) => {
    if (!s.exists()) return;

    const d = s.data();
    currentPrice = d.currentPrice || 0;

  // ▼ここに追加
    const nameEl = document.getElementById("itemNameDisplay");
    if (nameEl) nameEl.innerText = d.name || "";

    const currentPriceEl = document.getElementById("currentPrice");
    const topUserEl = document.getElementById("topUser");
    const pendingPriceEl = document.getElementById("pendingPrice");

    if (currentPriceEl) currentPriceEl.innerText = currentPrice;
    if (topUserEl) topUserEl.innerText = d.currentBidderNickname || "";

    // 自分の入札額が負けてたら同期
    if (pendingPrice <= currentPrice) {
      pendingPrice = currentPrice;
      if (pendingPriceEl) pendingPriceEl.innerText = pendingPrice;
    }
  });
});

// =======================
// 入札（加算）
// =======================
window.addBid = (n) => {
  pendingPrice = Math.max(pendingPrice, currentPrice) + n;

  const el = document.getElementById("pendingPrice");
  if (el) el.innerText = pendingPrice;
};

// =======================
// 入札確定
// =======================
window.confirmBid = async () => {
  const ref = doc(db, "auctions", auctionId);

  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);

      if (!s.exists()) throw "データなし";

      if (pendingPrice <= s.data().currentPrice) throw "負け";

      tx.update(ref, {
        currentPrice: pendingPrice,
        currentBidderNickname: currentUser.nickname
      });
    });

    const msg = document.getElementById("message");
    if (msg) msg.innerText = "🔥成功";
  } catch (e) {
    console.error(e);
    const msg = document.getElementById("message");
    if (msg) msg.innerText = "⚠️負け";
  }
};

// =======================
// 管理
// =======================
window.startAuction = () => {
  updateDoc(doc(db, "auctions", auctionId), { status: "OPEN" });
};

window.stopAuction = () => {
  updateDoc(doc(db, "auctions", auctionId), { status: "CLOSED" });
};

window.forceEnd = () => {
  updateDoc(doc(db, "auctions", auctionId), { status: "FORCED" });
};

// =======================
// 商品登録（時間付き）
// =======================
import { Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const addItem = async () => {
  const name = document.getElementById("itemName").value;
  const price = Number(document.getElementById("startPrice").value);

  const startAt = new Date(document.getElementById("startAt").value);
  const endAt = new Date(document.getElementById("endAt").value);

  if (!name || !price || !startAt || !endAt) {
    alert("全部入力してください");
    return;
  }

  await addDoc(collection(db, "auctions"), {
    name,
    currentPrice: price,
    currentBidderNickname: "",
    status: "WAITING",
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt)
  });

  alert("商品登録完了");
  loadItems();
};

// =======================
// 商品一覧
// =======================
const loadItems = async () => {
  const list = document.getElementById("itemList");
  if (!list) return;

  const snap = await getDocs(collection(db, "auctions"));

  list.innerHTML = "";

  snap.forEach(d => {
    const li = document.createElement("li");
    li.innerText = d.data().name;


    li.onclick = () => {
      localStorage.setItem("auctionId", d.id);
      location.href = "auction.html"; // ←追加
    };

    list.appendChild(li);
  });
};


// =======================
// ボタン紐付け（超重要）
// =======================
document.addEventListener("DOMContentLoaded", () => {

  // 商品登録ボタン
  const addBtn = document.getElementById("addItemBtn");
  if (addBtn) addBtn.addEventListener("click", addItem);

  // 商品一覧読み込み
  loadItems();

  // 登録ボタン
  const regBtn = document.getElementById("registerBtn");
  if (regBtn) regBtn.addEventListener("click", register);

  // ログインボタン
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", login);

  // 入札ボタン
  const btn100 = document.getElementById("btn100");
  const btn500 = document.getElementById("btn500");
  const confirmBtn = document.getElementById("confirmBtn");

  if (btn100) btn100.addEventListener("click", () => addBid(100));
  if (btn500) btn500.addEventListener("click", () => addBid(500));
  if (confirmBtn) confirmBtn.addEventListener("click", confirmBid);

});