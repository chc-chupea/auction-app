import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore, doc, setDoc, getDoc,
  updateDoc, onSnapshot, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const auctionId = "main";

let currentUser, pendingPrice = 0, currentPrice = 0;

// 登録
window.register = async () => {
  const name = document.getElementById("name").value;
  const nickname = document.getElementById("nickname").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    name, nickname, email, isAdmin: false
  });

  msg.innerText = "登録完了";
};

// ログイン
window.login = async () => {
  await signInWithEmailAndPassword(auth, email.value, password.value);
  location.href = "auction.html";
};

// 認証後
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  currentUser = snap.data();

  const ref = doc(db, "auctions", auctionId);

  onSnapshot(ref, (s) => {
    const d = s.data();
    currentPrice = d.currentPrice;

    if (currentPriceEl) currentPriceEl.innerText = currentPrice;
    if (topUser) topUser.innerText = d.currentBidderNickname;

    if (pendingPrice <= currentPrice) {
      pendingPrice = currentPrice;
      if (pendingPriceEl) pendingPriceEl.innerText = pendingPrice;
    }
  });
});

// 入札
window.addBid = (n) => {
  pendingPrice = Math.max(pendingPrice, currentPrice) + n;
  pendingPriceEl.innerText = pendingPrice;
};

// 確定
window.confirmBid = async () => {
  const ref = doc(db, "auctions", auctionId);

  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (pendingPrice <= s.data().currentPrice) throw "負け";

      tx.update(ref, {
        currentPrice: pendingPrice,
        currentBidderNickname: currentUser.nickname
      });
    });

    message.innerText = "🔥成功";
  } catch {
    message.innerText = "⚠️負け";
  }
};

// 管理
window.startAuction = () => updateDoc(doc(db,"auctions",auctionId),{status:"OPEN"});
window.stopAuction = () => updateDoc(doc(db,"auctions",auctionId),{status:"CLOSED"});
window.forceEnd = () => updateDoc(doc(db,"auctions",auctionId),{status:"FORCED"});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("registerBtn");
  if (btn) {
    btn.addEventListener("click", register);
  }
});