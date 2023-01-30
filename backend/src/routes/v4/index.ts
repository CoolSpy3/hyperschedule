import { App } from "@tinyhttp/app";
import { courseApp } from "./courses";
import { userApp } from "./user";

const v4App = new App().use(courseApp).use("/user/", userApp);

export { v4App };