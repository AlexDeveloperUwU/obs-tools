import e from "express";

export const router = e.Router();

router.get("/", (req, res) => {
  res.render("index");
});

export default router;