import { multiaddr } from "@multiformats/multiaddr";
import { ChatContext, ChatEventType } from "@ipdm/client";

let chatContext;

const invites = document.getElementById("invites");
const sendSection = document.getElementById("send-section");

async function createNode({ relayAddr, invite }) {
  console.log("relay???", relayAddr);
  const chat = await ChatContext.createP2PEncryptedChatContext({
    relayAddr,
  });
  chat.on(ChatEventType.channel_open, (event) => {
    console.log("channel_open", event);
    appendOutput(`Connected to '${relayAddr}'`);
  });
  chat.on(ChatEventType.channel_error, (event) => {
    console.log("channel_error", event);
    appendOutput(`Disconnected from peer`);
  });
  chat.on(ChatEventType.invite, (event) => {
    console.log("invite", event);
    appendOutput(`Got invite ${event.detail.invite}`);
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(event.detail.invite));
    invites.append(li);
  });
  chat.on(ChatEventType.initiated, (event) => {
    console.log("initiated", event);
    appendOutput(`Chat initiated`);
    sendSection.style.display = "block";
  });
  chat.on(ChatEventType.message, (event) => {
    console.log("message", event);
    appendOutput(`Received message '${JSON.stringify(event.detail)}'`);
  });
  if (invite) {
    await chat.joinWithInvite(invite);
  } else {
    await chat.createInviteAndWait();
  }

  return chat;
}

const output = document.getElementById("output");
const appendOutput = (line) => {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(line));
  output.append(div);
};
const clean = (line) => line.replaceAll("\n", "");

window.connect.onclick = async () => {
  const ma = multiaddr(window.peer.value);
  appendOutput(`Dialing '${ma}'`);
  chatContext = await createNode({
    relayAddr: ma.toString(),
    invite: window.invite.value,
  });
};

window.send.onclick = async () => {
  if (!chatContext) return;
  const message = `${window.message.value}\n`;
  appendOutput(`Sending message '${clean(message)}'`);
  chatContext.send({ msg: message });
};
