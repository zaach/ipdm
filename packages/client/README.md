The chat client package

## Use

Initiating peer:

```
const relayAddr = "/ip4/127...";
const chatContext = await ChatContext.createP2PEncryptedChatContext({
  relayAddr,
});

chatContext.on(ChatEventType.invite, (event) => {
  console.log(`Send this address to a friend: ${event.detail.invite}`);
});

chatContext.on(ChatEventType.initiated, (event) => {
  chatContext.send("Nice of you to make it.");
});

chatContext.on(ChatEventType.message, (event) => {
  console.log("Received message", event.detail.msg);
});

chatContext.createInviteAndWait();
```

Receiving peer:
```
const relayAddr = "/ip4/127...";
const chatContext = await ChatContext.createP2PEncryptedChatContext({
  relayAddr,
});
chatContext.on(ChatEventType.message, (event) => {
  console.log("Received message", event.detail.msg);
});

await chatContext.joinWithInvite(invite);
chatContext.send("Oh hai mark");
```
